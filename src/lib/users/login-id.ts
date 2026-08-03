/**
 * User ID logins ("pseudonymous accounts").
 *
 * Tenants that must not store PII can invite users with an admin-assigned
 * login ID plus a generated starter password instead of a real email address.
 * The login ID is mapped deterministically onto a synthetic email under the
 * RFC 2606-reserved "login.invalid" domain, which Supabase Auth accepts but
 * which can never receive mail — so the entire existing email+password auth
 * stack (sign-in, forced first-login password change) works unchanged while
 * the platform holds no personal data for these accounts.
 *
 * Gated per tenant by the `user_id_logins` feature flag (off by default).
 */

/** Reserved, never-routable domain that hosts synthetic auth emails. */
export const LOGIN_ID_EMAIL_DOMAIN = "login.invalid";

/**
 * 3–64 chars, letters/digits plus dot, dash, underscore inside; must start
 * and end alphanumeric so it forms a valid email local part.
 */
export const LOGIN_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{1,62}[A-Za-z0-9]$/;

export function isValidLoginId(value: string): boolean {
  return LOGIN_ID_PATTERN.test(value) && !value.includes("..");
}

/** Canonical stored/compared form of a login ID. */
export function normalizeLoginId(value: string): string {
  return value.trim().toLowerCase();
}

/** The synthetic auth email a login ID signs in with. */
export function loginIdToEmail(loginId: string): string {
  return `${normalizeLoginId(loginId)}@${LOGIN_ID_EMAIL_DOMAIN}`;
}

/** True when an email address is a synthetic login-ID address (no real inbox). */
export function isSyntheticLoginEmail(email: string | null | undefined): boolean {
  return !!email && email.toLowerCase().endsWith(`@${LOGIN_ID_EMAIL_DOMAIN}`);
}

/**
 * Resolve what a user typed in a login form to the email to authenticate
 * with: anything without "@" is treated as a login ID.
 */
export function loginIdentifierToEmail(identifier: string): string {
  const trimmed = identifier.trim();
  return trimmed.includes("@") ? trimmed : loginIdToEmail(trimmed);
}
