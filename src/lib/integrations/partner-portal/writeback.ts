import type { PortalOwnedUserField } from "./sync";

/**
 * Push an LMS-side edit of portal-owned fields back to the Partner Portal (the
 * system of record). Fire-and-forget: a write-back failure must never break the
 * local save — the nightly reconcile re-aligns if a push is missed.
 *
 * Only called for users whose row carries external_source = 'partner_portal';
 * the portal ingest then re-pushes the canonical value to CoachHub too.
 */
export async function postProfileWriteback(
  externalId: string,
  fields: Partial<Record<PortalOwnedUserField, unknown>>
): Promise<void> {
  const url = process.env.PARTNER_PORTAL_WRITEBACK_URL;
  const secret = process.env.PROFILE_WRITEBACK_SECRET;
  if (!url || !secret) return; // integration not configured — skip silently
  if (Object.keys(fields).length === 0) return;

  try {
    await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({ external_id: externalId, source: "lms", fields }),
    });
  } catch (err) {
    console.error("[partner-portal writeback]", err);
  }
}
