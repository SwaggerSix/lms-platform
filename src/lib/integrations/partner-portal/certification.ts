import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * LMS → Partner Portal: a staff-awarded credential (Mosaic Certified, a
 * Specialist) was awarded or revoked. The portal puts the matching
 * certification badge on — or takes it off — the partner's badge wall
 * (gc-partner-portal POST /api/integrations/lms-certification), and for
 * MOS-100 its Mosaic Certified (+5% partner code) follows.
 *
 * Same endpoint host and bearer as the profile write-back
 * (PARTNER_PORTAL_WRITEBACK_URL, PROFILE_WRITEBACK_SECRET). Never throws: the
 * award stands whatever the portal says, and the outcome is shown to the
 * assessor so a miss can be fixed by hand.
 */
export type PortalSyncOutcome =
  | "updated"        // badge added / removed on the partner's wall
  | "not_a_partner"  // no partner profile for this learner — nothing to do
  | "refused"        // the portal declined (e.g. a company that doesn't do the work)
  | "not_configured" // the LMS has no portal settings
  | "skipped"        // not a credential the portal tracks
  | "failed";        // couldn't reach the portal or it errored

export async function syncCertificationToPortal(
  service: SupabaseClient,
  userCertificationId: string,
  action: "award" | "revoke"
): Promise<PortalSyncOutcome> {
  try {
    const { data } = await service
      .from("user_certifications")
      .select(
        "expires_at, user:users!user_certifications_user_id_fkey(email, external_source, external_id), certification:certifications(capstone_key)"
      )
      .eq("id", userCertificationId)
      .maybeSingle();
    const cert = data?.certification as { capstone_key?: string | null } | null;
    const user = data?.user as { email?: string | null; external_source?: string | null; external_id?: string | null } | null;
    if (!data || !cert?.capstone_key) return "skipped";

    const base = process.env.PARTNER_PORTAL_WRITEBACK_URL;
    const secret = process.env.PROFILE_WRITEBACK_SECRET;
    if (!base || !secret) return "not_configured";

    const res = await fetch(new URL("/api/integrations/lms-certification", base), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}` },
      body: JSON.stringify({
        credential: cert.capstone_key,
        action,
        external_id: user?.external_source === "partner_portal" ? user.external_id ?? null : null,
        email: user?.email ?? null,
        expires_at: data.expires_at ? String(data.expires_at).slice(0, 10) : null,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    const body = (await res.json().catch(() => ({}))) as { status?: string };
    if (!res.ok) {
      console.error("[portal certification sync]", res.status, body);
      return "failed";
    }
    if (body.status === "applied") return "updated";
    if (body.status === "not_a_partner") return "not_a_partner";
    if (body.status === "refused") return "refused";
    return "failed";
  } catch (err) {
    console.error("[portal certification sync]", err);
    return "failed";
  }
}
