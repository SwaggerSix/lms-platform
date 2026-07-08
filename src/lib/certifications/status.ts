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
