import { createServiceClient } from "@/lib/supabase/service";
import { decryptIfEncrypted } from "@/lib/security/secret-crypto";
import type { PartnerPortalConfig } from "@/lib/integrations/partner-portal/types";

type Service = ReturnType<typeof createServiceClient>;

export interface PortalSyncResult {
  status: "awarded" | "already_awarded" | "renewed" | "not_applicable" | "not_configured" | "failed";
  at: string;
  profile_id?: string;
  invited?: boolean;
  error?: string;
}

/**
 * Where the portal is and the shared secret it expects (the portal's
 * LMS_SYNC_API_SECRET). Environment first (PARTNER_PORTAL_API_BASE +
 * PARTNER_PORTAL_SYNC_SECRET, set in Vercel), then an active Partner Portal
 * connection under Settings → Integrations.
 */
async function portalConfig(service: Service): Promise<PartnerPortalConfig | null> {
  const base = process.env.PARTNER_PORTAL_API_BASE?.trim();
  const secret = process.env.PARTNER_PORTAL_SYNC_SECRET?.trim();
  if (base && secret) return { api_base: base, api_secret: secret };
  const { data: integration } = await service
    .from("external_integrations")
    .select("config, is_active")
    .eq("provider", "partner_portal")
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();
  const config = integration?.config as PartnerPortalConfig | undefined;
  return config?.api_base && config?.api_secret ? config : null;
}

/**
 * Tells the partner portal that someone was certified, so it can invite them
 * (a certified-only account when they have none) and award the badge. The
 * portal endpoint is POST /api/integrations/lms/certifications, authenticated
 * with the portal's LMS_SYNC_API_SECRET (see portalConfig). Idempotent on the
 * certificate id, so a retry is always safe.
 *
 * The outcome is saved on user_certifications.metadata.portal_sync, which the
 * marking queue shows (with a Retry button when it didn't go through). Never
 * throws.
 */
export async function syncCertificationToPortal(service: Service, userCertificationId: string): Promise<PortalSyncResult> {
  const at = new Date().toISOString();
  let result: PortalSyncResult;
  let metadata: Record<string, unknown> = {};
  try {
    const { data: uc } = await service
      .from("user_certifications")
      .select("id, user_id, issued_at, expires_at, public_url, metadata, certification:certifications(portal_certification)")
      .eq("id", userCertificationId)
      .maybeSingle();
    if (!uc) return { status: "failed", at, error: "Certificate not found" };
    metadata = (uc.metadata as Record<string, unknown> | null) ?? {};
    const key = (uc.certification as { portal_certification?: string | null } | null)?.portal_certification ?? null;

    if (!key) {
      result = { status: "not_applicable", at };
    } else {
      const config = await portalConfig(service);
      if (!config) {
        result = { status: "not_configured", at, error: "The partner portal connection isn't set up (PARTNER_PORTAL_API_BASE / PARTNER_PORTAL_SYNC_SECRET)." };
      } else {
        const { data: user } = await service
          .from("users")
          .select("email, first_name, last_name")
          .eq("id", uc.user_id)
          .maybeSingle();
        const res = await fetch(new URL("/api/integrations/lms/certifications", config.api_base), {
          method: "POST",
          headers: {
            Authorization: `Bearer ${decryptIfEncrypted(config.api_secret)}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            email: user?.email,
            // The portal needs a first name; an LMS account may not have one.
            first_name: user?.first_name?.trim() || (user?.email ?? "").split("@")[0] || "Practitioner",
            last_name: user?.last_name ?? "",
            certification: key,
            issued_at: uc.issued_at,
            expires_at: uc.expires_at,
            verification_url: uc.public_url,
            external_id: uc.id,
          }),
          cache: "no-store",
          signal: AbortSignal.timeout(15000),
        });
        const json = (await res.json().catch(() => ({}))) as {
          status?: PortalSyncResult["status"];
          profile_id?: string;
          invited?: boolean;
          error?: string;
        };
        result = res.ok
          ? { status: json.status ?? "awarded", at, profile_id: json.profile_id, invited: json.invited }
          : { status: "failed", at, error: `Portal answered ${res.status}${json.error ? `: ${json.error}` : ""}` };
      }
    }
  } catch (err) {
    result = { status: "failed", at, error: err instanceof Error ? err.message : String(err) };
  }

  await service
    .from("user_certifications")
    .update({ metadata: { ...metadata, portal_sync: result } })
    .eq("id", userCertificationId);
  if (result.status === "failed" || result.status === "not_configured") {
    console.error("[capstones] portal sync:", result.status, result.error);
  }
  return result;
}
