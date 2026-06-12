import { createServiceClient } from "@/lib/supabase/service";
import { gemsAdapter } from "./adapter";
import type { GemsConfig, GemsEvent } from "./types";

const EXTERNAL_SOURCE = "gems";

export interface GemsSyncResult {
  events_created: number;
  events_updated: number;
  attendees_upserted: number;
  errors: string[];
}

type Service = ReturnType<typeof createServiceClient>;

/**
 * One-way import of GEMS events into the LMS.
 *
 * Reads the integration record from `external_integrations`, pulls events
 * (and their rosters) from GEMS, and upserts them into `ilt_sessions` /
 * `ilt_attendance` keyed by (external_source, external_id). Re-running is
 * safe: existing rows are updated, not duplicated. GEMS is never written to.
 *
 * @param integrationId - UUID of the external_integrations row (provider = 'gems')
 */
export async function syncGemsEvents(integrationId: string): Promise<GemsSyncResult> {
  const service = createServiceClient();
  const result: GemsSyncResult = {
    events_created: 0,
    events_updated: 0,
    attendees_upserted: 0,
    errors: [],
  };

  const { data: integration, error: intError } = await service
    .from("external_integrations")
    .select("*")
    .eq("id", integrationId)
    .single();

  if (intError || !integration) {
    throw new Error(`Integration not found: ${integrationId}`);
  }
  if (!integration.is_active) {
    throw new Error(`Integration ${integrationId} is not active`);
  }
  if (integration.provider !== EXTERNAL_SOURCE) {
    throw new Error(`Integration ${integrationId} is not a GEMS integration`);
  }

  const config = integration.config as GemsConfig;

  const { data: syncLog } = await service
    .from("integration_sync_logs")
    .insert({
      integration_id: integrationId,
      sync_type: "full",
      status: "started",
      started_at: new Date().toISOString(),
    })
    .select()
    .single();

  try {
    const events = await gemsAdapter.fetchEvents(config);

    for (const event of events) {
      try {
        const { sessionId, created } = await upsertSession(service, event, integrationId);
        if (created) result.events_created++;
        else result.events_updated++;

        // Roster sync is best-effort per event so one bad roster doesn't
        // abort the whole run.
        try {
          const attendees = await gemsAdapter.fetchAttendees(config, event.external_id);
          for (const attendee of attendees) {
            const userId = await resolveUserId(service, attendee.email);
            if (!userId) {
              result.errors.push(`Unmatched attendee ${attendee.email} on event ${event.external_id}`);
              continue;
            }
            await upsertAttendance(service, sessionId, userId, attendee);
            result.attendees_upserted++;
          }
        } catch (rosterErr) {
          result.errors.push(
            `Roster for event ${event.external_id}: ${rosterErr instanceof Error ? rosterErr.message : String(rosterErr)}`
          );
        }
      } catch (err) {
        result.errors.push(
          `Event ${event.external_id}: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }

    const status =
      result.errors.length > 0
        ? result.events_created + result.events_updated > 0
          ? "partial"
          : "failed"
        : "completed";

    await service
      .from("integration_sync_logs")
      .update({
        status,
        records_processed: events.length,
        records_created: result.events_created,
        records_updated: result.events_updated,
        records_failed: result.errors.length,
        errors: result.errors.map((e) => ({ error: e })),
        completed_at: new Date().toISOString(),
      })
      .eq("id", syncLog?.id);

    await service
      .from("external_integrations")
      .update({ last_sync_at: new Date().toISOString(), last_sync_status: status })
      .eq("id", integrationId);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    if (syncLog?.id) {
      await service
        .from("integration_sync_logs")
        .update({
          status: "failed",
          errors: [{ error: errorMessage }],
          completed_at: new Date().toISOString(),
        })
        .eq("id", syncLog.id);
    }
    await service
      .from("external_integrations")
      .update({ last_sync_at: new Date().toISOString(), last_sync_status: "failed" })
      .eq("id", integrationId);
    throw err;
  }

  return result;
}

// ─── Helpers ─────────────────────────────────────────────────────

/** Match a GEMS person to an existing LMS user by email. Returns null if none. */
async function resolveUserId(service: Service, email: string): Promise<string | null> {
  const { data } = await service
    .from("users")
    .select("id")
    .eq("email", email.toLowerCase())
    .maybeSingle();
  return data?.id ?? null;
}

/**
 * Resolve the LMS course for a GEMS event.
 *   1. Match by metadata->>'gems_course_code' (most reliable).
 *   2. Fall back to a case-insensitive title match on course_name.
 * Returns null if neither hits.
 */
async function resolveCourseId(service: Service, event: GemsEvent): Promise<string | null> {
  if (event.course_code) {
    const { data } = await service
      .from("courses")
      .select("id")
      .eq("metadata->>gems_course_code", event.course_code)
      .maybeSingle();
    if (data?.id) return data.id;
  }
  if (event.course_name) {
    const { data } = await service
      .from("courses")
      .select("id")
      .ilike("title", event.course_name)
      .maybeSingle();
    if (data?.id) return data.id;
  }
  return null;
}

/**
 * Auto-create an instructor-led LMS course for a GEMS event whose course
 * doesn't yet exist. Stores the GEMS course code in metadata so subsequent
 * syncs match by code. Title/slug derived from the GEMS course info.
 */
async function autoCreateCourse(service: Service, event: GemsEvent): Promise<string> {
  const title = event.course_name || event.course_code || event.title;
  const baseSlug = (event.course_code || title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
  // Slugs are unique; append a short suffix if a collision occurs.
  let slug = baseSlug;
  for (let i = 0; i < 5; i++) {
    const { data: clash } = await service
      .from("courses")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (!clash) break;
    slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;
  }

  const { data: inserted, error } = await service
    .from("courses")
    .insert({
      title,
      slug,
      course_type: "instructor_led",
      status: "published",
      metadata: { gems_course_code: event.course_code ?? null, auto_created_from: "gems" },
    })
    .select("id")
    .single();
  if (error || !inserted) {
    throw new Error(`Failed to auto-create course for "${title}": ${error?.message ?? "unknown"}`);
  }
  return inserted.id;
}

async function upsertSession(
  service: Service,
  event: GemsEvent,
  integrationId: string
): Promise<{ sessionId: string; created: boolean }> {
  const courseId =
    (await resolveCourseId(service, event)) ?? (await autoCreateCourse(service, event));
  const instructorId = event.instructor_email
    ? await resolveUserId(service, event.instructor_email)
    : null;

  const sessionData: Record<string, unknown> = {
    course_id: courseId,
    instructor_id: instructorId,
    title: event.title,
    description: event.description ?? null,
    session_date: event.session_date,
    start_time: event.start_time ?? "09:00",
    end_time: event.end_time ?? "17:00",
    timezone: event.timezone ?? "America/New_York",
    location_type: event.location_type ?? "virtual",
    location_details: event.location_details ?? null,
    meeting_url: event.meeting_url ?? null,
    max_capacity: event.max_capacity ?? 30,
    status: event.status ?? "scheduled",
    instructor_name: event.instructor_name ?? null,
    instructor_email: event.instructor_email ?? null,
    external_source: EXTERNAL_SOURCE,
    external_id: event.external_id,
    external_integration_id: integrationId,
    external_synced_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data: existing } = await service
    .from("ilt_sessions")
    .select("id")
    .eq("external_source", EXTERNAL_SOURCE)
    .eq("external_id", event.external_id)
    .maybeSingle();

  if (existing) {
    await service.from("ilt_sessions").update(sessionData).eq("id", existing.id);
    return { sessionId: existing.id, created: false };
  }

  const { data: inserted, error } = await service
    .from("ilt_sessions")
    .insert(sessionData)
    .select("id")
    .single();
  if (error || !inserted) {
    throw new Error(error?.message ?? "Failed to insert ilt_session");
  }
  return { sessionId: inserted.id, created: true };
}

async function upsertAttendance(
  service: Service,
  sessionId: string,
  userId: string,
  attendee: { external_id: string; registration_status?: string; attendance_status?: string; completion_status?: string; score?: number }
): Promise<void> {
  const row: Record<string, unknown> = {
    session_id: sessionId,
    user_id: userId,
    registration_status: attendee.registration_status ?? "registered",
    attendance_status: attendee.attendance_status ?? null,
    completion_status: attendee.completion_status ?? "not_started",
    score: attendee.score ?? null,
    external_source: EXTERNAL_SOURCE,
    external_id: attendee.external_id,
    updated_at: new Date().toISOString(),
  };

  // ilt_attendance has UNIQUE(session_id, user_id); upsert on that.
  await service.from("ilt_attendance").upsert(row, { onConflict: "session_id,user_id" });
}
