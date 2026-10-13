import { createServiceClient } from "@/lib/supabase/service";
import { partnerPortalClient } from "@/lib/integrations/partner-portal/client";
import type { GemsInstructorLink, PartnerPortalConfig } from "@/lib/integrations/partner-portal/types";
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
    const { events, warnings } = await gemsAdapter.fetchEvents(config);
    // A truncated GEMS search means events are missing: the run is partial.
    result.errors.push(...warnings);

    // GEMS instructors are mapped to people once, in the partner portal.
    const instructors = await loadPortalInstructorMap(service, result);

    for (const event of events) {
      try {
        const { sessionId, created } = await upsertSession(service, event, integrationId, instructors);
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

/**
 * GEMS instructor id → LMS user id, through the partner portal's mapping:
 * GEMS instructor → portal profile (mapped by portal admins) → the LMS user
 * mirrored from that profile (users.external_source = 'partner_portal',
 * external_id = profile id).
 *
 * Without an active partner_portal integration the map is empty and every
 * session falls back to email matching. A failed portal read is reported on
 * the run (it doesn't fail it): instructors are then matched by email only.
 */
async function loadPortalInstructorMap(
  service: Service,
  result: GemsSyncResult
): Promise<Map<number, string>> {
  const { data: portal } = await service
    .from("external_integrations")
    .select("config")
    .eq("provider", "partner_portal")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!portal?.config) return new Map();

  let links: GemsInstructorLink[];
  try {
    links = await partnerPortalClient.fetchGemsInstructorLinks(portal.config as PartnerPortalConfig);
  } catch (err) {
    result.errors.push(
      `Partner portal GEMS instructor mapping unavailable, matching instructors by email only: ${err instanceof Error ? err.message : String(err)}`
    );
    return new Map();
  }

  const profileIds = [...new Set(links.map((l) => l.profile_id))];
  const users: { id: string; external_id: string }[] = [];
  for (let i = 0; i < profileIds.length; i += 200) {
    const { data, error } = await service
      .from("users")
      .select("id, external_id")
      .eq("external_source", "partner_portal")
      .in("external_id", profileIds.slice(i, i + 200));
    if (error) {
      result.errors.push(`Reading portal-synced instructors: ${error.message}`);
      return new Map();
    }
    users.push(...((data ?? []) as { id: string; external_id: string }[]));
  }
  return buildInstructorMap(links, users);
}

/** GEMS instructor id → LMS user id, for links whose profile has an LMS user. */
export function buildInstructorMap(
  links: readonly GemsInstructorLink[],
  users: readonly { id: string; external_id: string }[]
): Map<number, string> {
  const userByProfile = new Map(users.map((u) => [u.external_id, u.id]));
  const out = new Map<number, string>();
  for (const l of links) {
    const userId = userByProfile.get(l.profile_id);
    if (userId) out.set(l.gems_instructor_id, userId);
  }
  return out;
}

/** The portal's GEMS mapping first; the GEMS instructor email as a fallback. */
async function resolveInstructorId(
  service: Service,
  event: GemsEvent,
  instructors: Map<number, string>
): Promise<string | null> {
  if (event.instructor_external_id !== undefined) {
    const mapped = instructors.get(event.instructor_external_id);
    if (mapped) return mapped;
  }
  return event.instructor_email ? resolveUserId(service, event.instructor_email) : null;
}

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
  // Oldest match first, never .maybeSingle(): that errors when two courses
  // match (e.g. two LMS courses mapped to one GEMS code), which read as "no
  // course" and auto-created yet another one on every sync.
  if (event.course_code) {
    const { data } = await service
      .from("courses")
      .select("id")
      .eq("metadata->>gems_course_code", event.course_code)
      .order("created_at", { ascending: true })
      .limit(1);
    if (data?.[0]?.id) return data[0].id;
  }
  if (event.course_name) {
    const { data } = await service
      .from("courses")
      .select("id")
      .ilike("title", escapeLike(event.course_name))
      .order("created_at", { ascending: true })
      .limit(1);
    if (data?.[0]?.id) return data[0].id;
  }
  return null;
}

/** Escape LIKE wildcards so a course title matches only itself. */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/**
 * Auto-create an instructor-led LMS course for a GEMS event whose course
 * doesn't yet exist. Stores the GEMS course code in metadata so subsequent
 * syncs match by code. Title/slug derived from the GEMS course info.
 *
 * Created as a draft: it has no content yet, so an admin maps it (GEMS →
 * Course mapping) or publishes it deliberately rather than learners finding
 * an empty course in the catalog.
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
      status: "draft",
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
  integrationId: string,
  instructors: Map<number, string>
): Promise<{ sessionId: string; created: boolean }> {
  const courseId =
    (await resolveCourseId(service, event)) ?? (await autoCreateCourse(service, event));
  const instructorId = await resolveInstructorId(service, event, instructors);

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
    const { error } = await service.from("ilt_sessions").update(sessionData).eq("id", existing.id);
    if (error) throw new Error(`Failed to update ilt_session: ${error.message}`);
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
