import crypto from "crypto";

/**
 * Shared-secret auth for inbound partner-portal → LMS calls.
 *
 * The portal presents `PARTNER_PORTAL_WEBHOOK_SECRET` as a Bearer token both
 * when it POSTs the profile-change webhook and when it pulls the Gotham course
 * catalog. Same trust direction (portal authenticating to the LMS), so the same
 * secret is reused rather than minting a second one.
 */
export function verifyPartnerPortalSecret(provided: string | null): boolean {
  const secret = process.env.PARTNER_PORTAL_WEBHOOK_SECRET;
  if (!secret || !provided) return false;
  try {
    const a = Buffer.from(provided);
    const b = Buffer.from(secret);
    // Length check first: timingSafeEqual throws on length mismatch.
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/** Extracts the Bearer token from an Authorization header, or null. */
export function bearerToken(authHeader: string | null): string | null {
  return authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
}
