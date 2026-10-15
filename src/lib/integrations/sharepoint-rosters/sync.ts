import { createServiceClient } from "@/lib/supabase/service";
import { SharePointClient, type DriveItem } from "./client";
import { dateFolderPrefix, pickClassFolder, pickRosterFile, type FolderCandidate, type SessionHints } from "./match";
import { parseRoster } from "./parser";
import type { RosterAttendee, SharePointRostersConfig } from "./types";

const EXTERNAL_SOURCE = "sharepoint_rosters";

export interface SharePointRosterSyncResult {
  sessions_processed: number;
  rosters_found: number;
  /** Roster lines saved (ilt_roster_entries), with or without an LMS account. */
  attendees_recorded: number;
  /** Of those, attendees who are LMS users (also written to ilt_attendance). */
  attendees_matched_to_users: number;
  /** Sessions with no class folder or no roster in it yet: normal, not errors. */
  missing: string[];
  /** Real problems: SharePoint unreachable, unreadable files, ambiguous folders. */
  errors: string[];
}

type Service = ReturnType<typeof createServiceClient>;

interface SessionRow {
  id: string;
  title: string | null;
  session_date: string;
  status: string | null;
  external_metadata: Record<string, unknown> | null;
  courses: { title: string | null; metadata: Record<string, unknown> | null } | null;
}

/**
 * Sync attendee rosters from SharePoint into ilt_roster_entries.
 *
 * Indexes the dated class folders under the root once (see match.ts for
 * why), then for each past GEMS-sourced session picks its class folder by
 * date (and course/customer when several classes share the date), parses
 * the roster workbook and records every attendee against the session.
 * Attendees who are LMS users also get ilt_attendance rows.
 *
 * Read-only against SharePoint. Idempotent: re-running replaces a session's
 * roster entries with what the current roster says.
 */
export async function syncSharePointRosters(
  integrationId: string
): Promise<SharePointRosterSyncResult> {
  const service = createServiceClient();
  const result: SharePointRosterSyncResult = {
    sessions_processed: 0,
    rosters_found: 0,
    attendees_recorded: 0,
    attendees_matched_to_users: 0,
    missing: [],
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
    // Past (or today's) GEMS-sourced sessions: future ones can't have rosters.
    const today = new Date().toISOString().slice(0, 10);
    const { data: sessionRows, error: sErr } = await service
      .from("ilt_sessions")
      .select("id, title, session_date, status, external_metadata, courses(title, metadata)")
      .eq("external_source", "gems")
      .lte("session_date", today)
      .order("session_date");
    if (sErr) throw new Error(`Failed to load ilt_sessions: ${sErr.message}`);
    const sessions = ((sessionRows ?? []) as unknown as SessionRow[]).filter((s) => s.status !== "cancelled");

    if (sessions.length > 0) {
      // One walk of the class folders for the whole run. If SharePoint can't
      // be reached this throws, and the run fails with the real reason.
      const minYear = Number(sessions[0].session_date.slice(0, 4));
      const folders: FolderCandidate[] = (await client.indexClassFolders(`/${config.root_folder}`, { minYear })).map((f) => ({
        id: f.id,
        name: f.name,
        parentPath: f.parentReference?.path ?? "",
      }));

      for (const session of sessions) {
        result.sessions_processed++;
        const label = `${session.title ?? "Session"} @ ${session.session_date}`;
        try {
          const match = pickClassFolder(folders, hintsFor(session));
          if (match.kind === "none") {
            result.missing.push(`${label}: no class folder dated ${dateFolderPrefix(session.session_date)}`);
            continue;
          }
          if (match.kind === "ambiguous") {
            result.errors.push(
              `${label}: several class folders that day and nothing to choose between them (${match.folders.map((f) => folderLabel(f)).join("; ")})`
            );
            continue;
          }

          const files = await client.listFiles(match.folder.id);
          const roster = pickRosterFile(files);
          if (!roster) {
            result.missing.push(`${label}: no roster workbook in ${folderLabel(match.folder)}`);
            continue;
          }
          result.rosters_found++;

          const bytes = await client.downloadItem(roster.id);
          const attendees = parseRoster(bytes, config);
          const saved = await saveRoster(service, session.id, attendees, roster);
          result.attendees_recorded += saved.recorded;
          result.attendees_matched_to_users += saved.matched;
        } catch (err) {
          result.errors.push(`${label}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }

    // Missing rosters are expected (not every class files one); only real
    // errors make a run partial or failed.
    const status =
      result.errors.length === 0 ? "completed" : result.rosters_found > 0 ? "partial" : "failed";

    await service
      .from("integration_sync_logs")
      .update({
        status,
        records_processed: result.sessions_processed,
        records_created: result.attendees_recorded,
        records_updated: 0,
        records_failed: result.errors.length,
        errors: [
          ...result.errors.map((e) => ({ error: e })),
          ...result.missing.map((m) => ({ record: "no_roster", error: m })),
        ],
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

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

/** What the session knows about itself, for telling same-day class folders apart. */
function hintsFor(session: SessionRow): SessionHints {
  const ext = session.external_metadata ?? {};
  const courseMeta = session.courses?.metadata ?? {};
  const code = str(ext.course_code) ?? str(courseMeta.gems_course_code) ?? str(courseMeta.course_code);
  return {
    session_date: session.session_date,
    title: session.title,
    course_title: session.courses?.title ?? null,
    course_code: code && code !== "0" ? code : null,
    customer_name: str(ext.customer_name),
    customer_code: str(ext.customer_code),
  };
}

function folderLabel(f: FolderCandidate): string {
  const path = f.parentPath.replace(/^.*?root:/, "");
  return `${path}/${f.name}`;
}

/**
 * Replace the session's roster entries with this roster's attendees (an
 * attendee dropped from the roster is dropped here too), and mirror
 * attendees who are LMS users into ilt_attendance.
 */
async function saveRoster(
  service: Service,
  sessionId: string,
  attendees: RosterAttendee[],
  file: DriveItem
): Promise<{ recorded: number; matched: number }> {
  const byEmail = new Map<string, RosterAttendee>();
  for (const a of attendees) {
    const email = a.email.trim().toLowerCase();
    if (email) byEmail.set(email, a);
  }
  const emails = [...byEmail.keys()];

  const userIds = new Map<string, string>();
  for (let i = 0; i < emails.length; i += 200) {
    const { data, error } = await service.from("users").select("id, email").in("email", emails.slice(i, i + 200));
    if (error) throw new Error(`Matching attendees to users: ${error.message}`);
    for (const u of data ?? []) userIds.set((u.email as string).toLowerCase(), u.id as string);
  }

  const now = new Date().toISOString();
  const rows = emails.map((email) => {
    const a = byEmail.get(email)!;
    return {
      session_id: sessionId,
      email,
      full_name: a.full_name ?? null,
      org: a.org ?? null,
      days_total: a.days_total,
      days_attended: a.days_attended,
      attendance_status: a.attendance_status,
      user_id: userIds.get(email) ?? null,
      source_drive_item_id: file.id,
      source_file_name: file.name,
      source_web_url: file.webUrl ?? null,
      synced_at: now,
    };
  });
  if (rows.length > 0) {
    const { error } = await service.from("ilt_roster_entries").upsert(rows, { onConflict: "session_id,email" });
    if (error) throw new Error(`Saving roster entries: ${error.message}`);
  }
  // Drop entries no longer on the roster.
  let stale = service.from("ilt_roster_entries").delete().eq("session_id", sessionId);
  if (emails.length > 0) stale = stale.not("email", "in", `(${emails.map((e) => `"${e.replace(/"/g, '""')}"`).join(",")})`);
  const { error: delErr } = await stale;
  if (delErr) throw new Error(`Clearing old roster entries: ${delErr.message}`);

  let matched = 0;
  for (const [email, userId] of userIds) {
    await upsertAttendance(service, sessionId, userId, byEmail.get(email)!, file.id);
    matched++;
  }
  return { recorded: rows.length, matched };
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
      // A roster without attendance columns only says they registered.
      attendance_status: attendee.attendance_status === "unknown" ? null : attendee.attendance_status,
      completion_status:
        attendee.attendance_status === "unknown" ? null : attendee.attendance_status === "present" ? "completed" : "failed",
      org: attendee.org ?? null,
      external_source: EXTERNAL_SOURCE,
      external_id: `${driveItemId}:${attendee.email}`,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "session_id,user_id" }
  );
}
