// ─────────────────────────────────────────────────────────────────
// Partner Portal integration types
//
// The gC Partner Portal (a separate Next.js + Supabase app) is the
// system of record for subcontractor master profiles. It exposes a
// read API at /api/integrations/lms/* secured by a shared bearer
// secret, and pushes a lightweight webhook on every relevant profile
// change. These types describe the connection config (stored in
// external_integrations.config) and the canonical instructor shape
// returned by the portal read API.
// ─────────────────────────────────────────────────────────────────

/** Connection config, stored in external_integrations.config. */
export interface PartnerPortalConfig {
  /** Base URL of the partner portal, e.g. "https://partners.gothamculture.com". */
  api_base: string;
  /**
   * Shared secret the LMS presents (as a Bearer token) when calling the
   * portal read API. Must match the portal's LMS_SYNC_API_SECRET env var.
   */
  api_secret: string;
}

export type CanonicalInstructorStatus = "active" | "inactive";

/**
 * Canonical instructor profile as returned by the portal read API.
 * This is the subset of the portal `profiles` table that the LMS
 * mirrors onto a users row — the LMS instructor model only carries
 * name, email, bio, avatar and status.
 */
export interface CanonicalInstructor {
  /** Portal profile id (UUID) — the stable idempotency key. */
  external_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  /** Derived by the portal from offboarding_status. */
  status: CanonicalInstructorStatus;
  /** ISO timestamp of the profile's last change (drives incremental sync). */
  updated_at: string;
}
