/** Shared certification status semantics (UX review §2.9: one source of
 * truth for how cert status is derived across certifications, transcript,
 * and profile). */

export type CertStatus = "active" | "expiring_soon" | "expired";

/** Expiry within 90 days is considered "expiring soon". */
export const EXPIRING_SOON_DAYS = 90;

export function deriveStatus(dbStatus: string, expiresAt: string | null): CertStatus {
  if (dbStatus === "expired" || dbStatus === "revoked") return "expired";
  if (dbStatus === "active" && expiresAt) {
    const now = new Date();
    const expiry = new Date(expiresAt);
    const daysUntilExpiry = (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    if (daysUntilExpiry <= 0) return "expired";
    if (daysUntilExpiry <= EXPIRING_SOON_DAYS) return "expiring_soon";
  }
  return "active";
}

/** For staff screens: an active certificate expiring within EXPIRING_SOON_DAYS. */
export function expiringSoon(expiresAt: string | null, status: string, now = new Date()): boolean {
  if (status !== "active" || !expiresAt) return false;
  const left = new Date(expiresAt).getTime() - now.getTime();
  return left > 0 && left <= EXPIRING_SOON_DAYS * 86_400_000;
}
