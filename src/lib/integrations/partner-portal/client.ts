import { decryptIfEncrypted } from "@/lib/security/secret-crypto";
import type { CanonicalInstructor, GemsInstructorLink, PartnerPortalConfig } from "./types";

// HTTP client for the gC Partner Portal read API. The portal owns the
// canonical subcontractor profiles; the LMS only reads. Auth is a shared
// bearer secret (config.api_secret == portal LMS_SYNC_API_SECRET), stored
// encrypted at rest like other integration secrets.

function authHeaders(config: PartnerPortalConfig): HeadersInit {
  return {
    Authorization: `Bearer ${decryptIfEncrypted(config.api_secret)}`,
    Accept: "application/json",
  };
}

export const partnerPortalClient = {
  /**
   * Fetch subcontractor instructor profiles. When `updatedSince` is given,
   * the portal returns only profiles changed at/after that ISO timestamp
   * (incremental sync); otherwise it returns the full set.
   */
  async fetchInstructors(
    config: PartnerPortalConfig,
    updatedSince?: string | null
  ): Promise<CanonicalInstructor[]> {
    const url = new URL("/api/integrations/lms/instructors", config.api_base);
    if (updatedSince) url.searchParams.set("updated_since", updatedSince);

    const res = await fetch(url, { headers: authHeaders(config), cache: "no-store" });
    if (!res.ok) {
      throw new Error(
        `Partner portal instructors fetch failed: ${res.status} ${await res.text()}`
      );
    }
    const json = (await res.json()) as { instructors: CanonicalInstructor[] };
    return json.instructors ?? [];
  },

  /**
   * Fetch a single instructor profile by portal profile id. Returns null when
   * the portal reports 404 (profile deleted or not a syncable subcontractor).
   */
  async fetchInstructor(
    config: PartnerPortalConfig,
    profileId: string
  ): Promise<CanonicalInstructor | null> {
    const url = new URL(`/api/integrations/lms/instructors/${profileId}`, config.api_base);

    const res = await fetch(url, { headers: authHeaders(config), cache: "no-store" });
    if (res.status === 404) return null;
    if (!res.ok) {
      throw new Error(
        `Partner portal instructor fetch failed: ${res.status} ${await res.text()}`
      );
    }
    return (await res.json()) as CanonicalInstructor;
  },

  /**
   * The portal's full GEMS instructor → portal profile mapping. GEMS
   * instructors are mapped to people once, in the portal; the LMS GEMS sync
   * uses this to assign each session's instructor.
   */
  async fetchGemsInstructorLinks(config: PartnerPortalConfig): Promise<GemsInstructorLink[]> {
    const url = new URL("/api/integrations/lms/gems-instructors", config.api_base);
    const res = await fetch(url, { headers: authHeaders(config), cache: "no-store" });
    if (!res.ok) {
      throw new Error(`Partner portal GEMS instructor links fetch failed: ${res.status}`);
    }
    const json = (await res.json()) as { links?: GemsInstructorLink[] };
    return json.links ?? [];
  },

  /** Settings → Integrations "Test connection": the cheapest authenticated read. */
  async testConnection(config: PartnerPortalConfig): Promise<{ success: boolean; message: string }> {
    if (!config.api_base || !config.api_secret) {
      return { success: false, message: "Partner Portal URL and Sync Secret are required" };
    }
    try {
      const links = await partnerPortalClient.fetchGemsInstructorLinks(config);
      return { success: true, message: `Connected to the partner portal (${links.length} GEMS instructor link${links.length === 1 ? "" : "s"})` };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return { success: false, message: /\b401\b/.test(message) ? "The portal rejected the Sync Secret (401): it must match LMS_SYNC_API_SECRET there" : message };
    }
  },
};
