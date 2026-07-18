import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Self-registration policy (S6).
 *
 * The mode is admin-configurable via the `registration` row in
 * platform_settings. Precedence:
 *   1. the stored admin setting, when it specifies a valid mode;
 *   2. otherwise the REGISTRATION_MODE / REGISTRATION_ALLOWED_DOMAINS env vars
 *      (back-compat with the earlier env-only gate);
 *   3. otherwise a secure default of "closed" (invite-only) — a corporate B2B
 *      training platform should not allow unrestricted self-provisioning.
 */

export type RegistrationMode = "open" | "domain" | "closed";

export interface RegistrationPolicy {
  mode: RegistrationMode;
  allowedDomains: string[];
}

function normalizeMode(value: unknown): RegistrationMode | null {
  const v = typeof value === "string" ? value.trim().toLowerCase() : "";
  return v === "open" || v === "domain" || v === "closed" ? v : null;
}

function normalizeDomains(value: unknown): string[] {
  const list = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : [];
  return list
    .map((d) => String(d).trim().toLowerCase().replace(/^@/, ""))
    .filter(Boolean);
}

/** Resolve the effective registration policy from settings, env, then default. */
export async function resolveRegistrationPolicy(
  service: SupabaseClient
): Promise<RegistrationPolicy> {
  let mode: RegistrationMode | null = null;
  let allowedDomains: string[] = [];

  // 1. Admin setting.
  const { data } = await service
    .from("platform_settings")
    .select("value")
    .eq("key", "registration")
    .maybeSingle();
  const setting = (data?.value ?? null) as
    | { mode?: unknown; allowed_domains?: unknown }
    | null;
  if (setting) {
    mode = normalizeMode(setting.mode);
    allowedDomains = normalizeDomains(setting.allowed_domains);
  }

  // 2. Env fallback (only when the setting didn't specify a mode).
  if (!mode) {
    mode = normalizeMode(process.env.REGISTRATION_MODE);
    if (!allowedDomains.length) {
      allowedDomains = normalizeDomains(process.env.REGISTRATION_ALLOWED_DOMAINS);
    }
  }

  // 3. Secure default.
  if (!mode) mode = "closed";

  return { mode, allowedDomains };
}

/**
 * Decide whether an email may self-register under a policy. Returns a reason
 * (for the API error) when disallowed.
 */
export function evaluateRegistration(
  policy: RegistrationPolicy,
  email: string
): { allowed: boolean; reason?: string } {
  if (policy.mode === "closed") {
    return {
      allowed: false,
      reason: "Self-registration is disabled. Please contact your administrator for an invitation.",
    };
  }
  if (policy.mode === "domain") {
    const domain = email.split("@")[1]?.toLowerCase() ?? "";
    if (!policy.allowedDomains.includes(domain)) {
      return { allowed: false, reason: "Registration is restricted to approved email domains." };
    }
  }
  return { allowed: true };
}
