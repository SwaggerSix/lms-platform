import crypto from "crypto";
import { createServiceClient } from "@/lib/supabase/service";
import { partnerPortalClient } from "./client";
import type { CanonicalInstructor, PartnerPortalConfig } from "./types";

export const EXTERNAL_SOURCE = "partner_portal";

/**
 * Portal-owned fields on the LMS users row. The partner portal is the system
 * of record for these, so the LMS profile/users API routes reject edits to
 * them for partner_portal-sourced users (see api/profile, api/users/[id]).
 */
export const PORTAL_OWNED_USER_FIELDS = [
  "first_name",
  "last_name",
  "email",
  "bio",
  "avatar_url",
] as const;

export type PortalOwnedUserField = (typeof PORTAL_OWNED_USER_FIELDS)[number];

type Service = ReturnType<typeof createServiceClient>;

export interface PartnerPortalSyncResult {
  instructors_created: number;
  instructors_updated: number;
  errors: string[];
}

// 16 bytes base64url ≈ 22 chars; Supabase requires ≥6.
function generateTemporaryPassword(): string {
  return crypto.randomBytes(16).toString("base64url");
}

/**
 * Upsert one canonical instructor into the LMS `users` table.
 *
 * Matching: first by provenance key (external_source + external_id), then by
 * email so a subcontractor who already exists as an LMS user is adopted rather
 * than duplicated. New subcontractors get a full LMS instructor account (a
 * Supabase auth user + a users row with role 'instructor').
 *
 * Used by both the real-time webhook and the scheduled reconcile so the two
 * paths can never diverge.
 */
export async function upsertInstructor(
  service: Service,
  instructor: CanonicalInstructor,
  integrationId: string | null
): Promise<{ created: boolean }> {
  const email = instructor.email.toLowerCase();
  const status = instructor.status === "active" ? "active" : "inactive";

  let existing: { id: string; auth_id: string | null; role: string } | null = null;

  const { data: byExternal } = await service
    .from("users")
    .select("id, auth_id, role")
    .eq("external_source", EXTERNAL_SOURCE)
    .eq("external_id", instructor.external_id)
    .maybeSingle();
  existing = byExternal ?? null;

  if (!existing) {
    const { data: byEmail } = await service
      .from("users")
      .select("id, auth_id, role")
      .eq("email", email)
      .maybeSingle();
    existing = byEmail ?? null;
  }

  // Portal-owned content + provenance stamp. Re-applied on every sync.
  const synced: Record<string, unknown> = {
    first_name: instructor.first_name ?? "",
    last_name: instructor.last_name ?? "",
    email,
    bio: instructor.bio,
    avatar_url: instructor.avatar_url,
    status,
    external_source: EXTERNAL_SOURCE,
    external_id: instructor.external_id,
    external_integration_id: integrationId,
    external_synced_at: new Date().toISOString(),
  };

  if (existing) {
    // Promote a plain learner to instructor, but never demote an existing
    // admin/manager/super_admin who also happens to be a subcontractor.
    if (existing.role === "learner") synced.role = "instructor";
    const { error } = await service.from("users").update(synced).eq("id", existing.id);
    if (error) throw new Error(`update user failed for ${email}: ${error.message}`);
    return { created: false };
  }

  // New subcontractor → provision a full LMS instructor account so they can
  // log in and manage their classes. Mirrors POST /api/users.
  const temporaryPassword = generateTemporaryPassword();
  const { data: authCreated, error: authErr } = await service.auth.admin.createUser({
    email,
    password: temporaryPassword,
    email_confirm: true,
  });

  let authId: string | null = null;
  if (authErr) {
    // An auth account may already exist (created out of band). Don't fail the
    // whole sync — create the users row without auth_id; an admin can relink.
    if (!/registered|exists/i.test(authErr.message)) {
      throw new Error(`auth account create failed for ${email}: ${authErr.message}`);
    }
  } else {
    authId = authCreated?.user?.id ?? null;
  }

  const { error: insertErr } = await service.from("users").insert({
    ...synced,
    auth_id: authId,
    role: "instructor",
    preferences: { must_change_password: true, source: EXTERNAL_SOURCE },
  });

  if (insertErr) {
    // Roll back the orphaned auth user so a retry can recreate cleanly.
    if (authId) await service.auth.admin.deleteUser(authId).catch(() => {});
    throw new Error(`insert user failed for ${email}: ${insertErr.message}`);
  }
  return { created: true };
}

/**
 * Full reconcile of partner-portal subcontractors into LMS instructors.
 *
 * Reads the integration record from `external_integrations`, pulls every
 * profile changed since the last successful sync (or all on first run), and
 * upserts each. Re-running is safe: rows are upserted by (external_source,
 * external_id), never duplicated. This is the safety net behind the real-time
 * webhook — it catches any push that was missed.
 *
 * @param integrationId - UUID of the external_integrations row (provider = 'partner_portal')
 */
export async function syncPartnerPortalInstructors(
  integrationId: string
): Promise<PartnerPortalSyncResult> {
  const service = createServiceClient();
  const result: PartnerPortalSyncResult = {
    instructors_created: 0,
    instructors_updated: 0,
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
    throw new Error(`Integration ${integrationId} is not a partner_portal integration`);
  }

  const config = integration.config as PartnerPortalConfig;
  // Incremental watermark: only pull profiles changed since the last run.
  const updatedSince = (integration.last_sync_at as string | null) ?? null;

  const { data: syncLog } = await service
    .from("integration_sync_logs")
    .insert({
      integration_id: integrationId,
      sync_type: updatedSince ? "incremental" : "full",
      status: "started",
      started_at: new Date().toISOString(),
    })
    .select()
    .single();

  // Stamp the watermark from BEFORE the fetch so edits made mid-run are
  // re-pulled next time rather than skipped.
  const runStartedAt = new Date().toISOString();

  try {
    const instructors = await partnerPortalClient.fetchInstructors(config, updatedSince);

    for (const instructor of instructors) {
      try {
        const { created } = await upsertInstructor(service, instructor, integrationId);
        if (created) result.instructors_created++;
        else result.instructors_updated++;
      } catch (err) {
        result.errors.push(
          `Profile ${instructor.external_id} (${instructor.email}): ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }

    const status =
      result.errors.length > 0
        ? result.instructors_created + result.instructors_updated > 0
          ? "partial"
          : "failed"
        : "completed";

    await service
      .from("integration_sync_logs")
      .update({
        status,
        records_processed: instructors.length,
        records_created: result.instructors_created,
        records_updated: result.instructors_updated,
        records_failed: result.errors.length,
        errors: result.errors.map((e) => ({ error: e })),
        completed_at: new Date().toISOString(),
      })
      .eq("id", syncLog?.id);

    // Only advance the watermark when we actually processed the batch. A hard
    // failure leaves last_sync_at untouched so the next run re-pulls.
    await service
      .from("external_integrations")
      .update({ last_sync_at: runStartedAt, last_sync_status: status })
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
    // Record the failure but DO NOT advance last_sync_at — preserve the watermark.
    await service
      .from("external_integrations")
      .update({ last_sync_status: "failed" })
      .eq("id", integrationId);
    throw err;
  }

  return result;
}
