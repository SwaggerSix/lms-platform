import type { CanonicalInstructor, PartnerPortalConfig } from "./types";

// HTTP client for the gC Partner Portal read API. The portal owns the
// canonical subcontractor profiles; the LMS only reads. Auth is a shared
// bearer secret (config.api_secret == portal LMS_SYNC_API_SECRET).

function authHeaders(config: PartnerPortalConfig): HeadersInit {
  return {
    Authorization: `Bearer ${config.api_secret}`,
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
};
