import { createServiceClient } from "@/lib/supabase/service";
import { SharePointClient, type DriveItem } from "./client";
import { parseRoster } from "./parser";
import type { ParsedRoster, RosterAttendee, SharePointRostersConfig } from "./types";

const EXTERNAL_SOURCE = "sharepoint_rosters";

export interface SharePointRosterSyncResult {
  sessions_processed: number;
  rosters_found: number;
  attendees_upserted: number;
  errors: string[];
}

type Service = ReturnType<typeof createServiceClient>;

/**
 * Sync attendee rosters from SharePoint into ilt_attendance.
 *
 * Walks all GEMS-sourced ilt_sessions whose date is in the past (or today),
 * locates the matching roster .xlsx in SharePoint by (courseCode, startDate),
 * parses it, and upserts each attendee against their LMS user.
 *
 * Read-only against SharePoint. Idempotent.
 */
export async function syncSharePointRosters(
  integrationId: string
): Promise<SharePointRosterSyncResult> {
  const service = createServiceClient();
  const result: SharePointRosterSyncResult = {
    sessions_processed: 0,
    rosters_found: 0,
    attendees_upserted: 0,
    errors: [],
  };

  const { data: integration, error: intError } = await service
    .from("external_integrations")
    .select("*")
    .eq("id", integrationId)
    .single();
  if (intError || !integration) throw new Error(`Integration not found: ${integrationId}`);
  if (!integration.is_active) throw new Error(`Integration ${integrationId} is not active`);
  if (integration.provider !== EXTERNAL_SOURCE) {
    throw new Error(`Integration ${integrationId} is not a SharePoint rosters integration`);
  }

  const config = integration.config as SharePointRostersConfig;
  const client = new SharePointClient(config);

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
    // Pull GEMS-sourced sessions whose date has arrived; future sessions
    // can't have rosters yet.
    const today = new Date().toISOString().slice(0, 10);
    const { data: sessions, error: sErr } = await service
      .from("ilt_sessions")
      .select(
        "id, title, session_date, external_source, external_id, course_id, courses(metadata, title)"
      )
      .eq("external_source", "gems")
      .lte("session_date", today);

    if (sErr) throw new Error(`Failed to load ilt_sessions: ${sErr.message}`);

    for (const session of sessions ?? []) {
      result.sessions_processed++;
      try {
        const courseCode = extractCourseCode(session);
        if (!courseCode) {
          result.errors.push(`Session ${session.id}: no course code, skipping`);
          continue;
        }

        const parsed = await findAndParseRoster(client, config, courseCode, session.session_date);
        if (!parsed) {
          result.errors.push(
            `Session ${session.id} (${courseCode} @ ${session.session_date}): no roster file found`
          );
          continue;
        }
        result.rosters_found++;

        for (const attendee of parsed.attendees) {
          const userId = await resolveUserId(service, attendee.email);
          if (!userId) {
            result.errors.push(`Unmatched attendee ${attendee.email} in ${parsed.file_name}`);
            continue;
          }
          await upsertAttendance(service, session.id, userId, attendee, parsed.drive_item_id);
          result.attendees_upserted++;
        }
      } catch (err) {
        result.errors.push(
          `Session ${session.id}: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }

    const status =
      result.errors.length > 0
        ? result.attendees_upserted > 0
          ? "partial"
          : "failed"
        : "completed";

    await service
      .from("integration_sync_logs")
      .update({
        status,
        records_processed: result.sessions_processed,
        records_created: result.attendees_upserted,
        records_updated: 0,
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
 * Pull the GEMS course code from the joined courses row.
 * Auto-created GEMS courses store it as metadata.gems_course_code;
 * pre-existing courses may not, so we fall back to parsing the title.
 */
function extractCourseCode(session: any): string | null {
  const meta = session.courses?.metadata ?? {};
  const code =
    meta.gems_course_code ?? meta.course_code ?? session.courses?.title?.split(" -")[0]?.trim();
  return typeof code === "string" && code.length > 0 ? code : null;
}

/**
 * Look in `{root}/{courseCode}/{YYYY.MM.DD …}/` for a matching roster file.
 * Falls back to `{root}/{archive}/{courseCode}/…` for older classes.
 *
 * Picks the most-recently-modified .xlsx whose name contains "Roster"; if no
 * file matches that, falls back to the most recently modified .xlsx in the
 * folder.
 */
async function findAndParseRoster(
  client: SharePointClient,
  config: SharePointRostersConfig,
  courseCode: string,
  sessionDate: string
): Promise<ParsedRoster | null> {
  const dateFolderPrefix = sessionDate.replace(/-/g, ".");
  const candidates = [`/${config.root_folder}/${courseCode}`];
  if (config.archive_folder) {
    candidates.push(`/${config.root_folder}/${config.archive_folder}/${courseCode}`);
  }

  for (const courseFolder of candidates) {
    let subfolders: DriveItem[];
    try {
      subfolders = await client.listChildren(courseFolder);
    } catch {
      continue; // missing folder is normal
    }

    // Some archives nest by FY year, e.g. _Archive/CON 270/FY24. If no
    // direct date-prefix match, recurse one level into year folders.
    const directMatch = subfolders.find((f) => f.folder && f.name.startsWith(dateFolderPrefix));
    let eventFolderPath: string | null = null;
    if (directMatch) {
      eventFolderPath = `${courseFolder}/${directMatch.name}`;
    } else {
      for (const fyFolder of subfolders.filter((f) => f.folder)) {
        const fySubs = await client.listChildren(`${courseFolder}/${fyFolder.name}`).catch(() => []);
        const m = fySubs.find((f) => f.folder && f.name.startsWith(dateFolderPrefix));
        if (m) {
          eventFolderPath = `${courseFolder}/${fyFolder.name}/${m.name}`;
          break;
        }
      }
    }
    if (!eventFolderPath) continue;

    const files = await client.listChildren(eventFolderPath).catch(() => []);
    const xlsx = files.filter((f) => f.file && f.name.toLowerCase().endsWith(".xlsx"));
    if (xlsx.length === 0) continue;

    const preferred = xlsx
      .filter((f) => /roster/i.test(f.name))
      .sort((a, b) => b.lastModifiedDateTime.localeCompare(a.lastModifiedDateTime))[0];
    const chosen =
      preferred ??
      xlsx.sort((a, b) => b.lastModifiedDateTime.localeCompare(a.lastModifiedDateTime))[0];

    const bytes = await client.downloadItem(chosen.id);
    const attendees = parseRoster(bytes, config);
    return { drive_item_id: chosen.id, file_name: chosen.name, attendees };
  }

  return null;
}

async function resolveUserId(service: Service, email: string): Promise<string | null> {
  const { data } = await service
    .from("users")
    .select("id")
    .eq("email", email.toLowerCase())
    .maybeSingle();
  return data?.id ?? null;
}

async function upsertAttendance(
  service: Service,
  sessionId: string,
  userId: string,
  attendee: RosterAttendee,
  driveItemId: string
): Promise<void> {
  await service.from("ilt_attendance").upsert(
    {
      session_id: sessionId,
      user_id: userId,
      registration_status: "registered",
      attendance_status: attendee.attendance_status,
      completion_status: attendee.attendance_status === "present" ? "completed" : "failed",
      org: attendee.org ?? null,
      external_source: EXTERNAL_SOURCE,
      external_id: `${driveItemId}:${attendee.email}`,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "session_id,user_id" }
  );
}
