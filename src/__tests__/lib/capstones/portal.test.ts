import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { syncCertificationToPortal } from "@/lib/capstones/portal";

let saved: Record<string, unknown> | null;

function fakeService(portalCertification: string | null) {
  return {
    from: (table: string) => {
      const q: Record<string, unknown> = {};
      let patch: Record<string, unknown> | null = null;
      for (const op of ["select", "eq", "limit"]) q[op] = () => q;
      q.update = (p: Record<string, unknown>) => {
        patch = p;
        return q;
      };
      q.maybeSingle = async () => {
        if (table === "user_certifications")
          return {
            data: {
              id: "uc-1", user_id: "u-1", issued_at: "2026-11-11T00:00:00Z", expires_at: "2031-11-11T00:00:00Z",
              public_url: "https://learn.example/verify/LMS-AAAA", metadata: { source: "capstone" },
              certification: { portal_certification: portalCertification },
            },
          };
        if (table === "users") return { data: { email: "sam@example.com", first_name: "Sam", last_name: "Lee" } };
        return { data: null };
      };
      q.then = (res: (v: unknown) => unknown) => {
        if (patch) saved = patch.metadata as Record<string, unknown>;
        return Promise.resolve({ data: null, error: null }).then(res);
      };
      return q;
    },
  } as never;
}

beforeEach(() => {
  saved = null;
  vi.stubEnv("PARTNER_PORTAL_API_BASE", "https://portal.example");
  vi.stubEnv("PARTNER_PORTAL_SYNC_SECRET", "s3cret");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("syncCertificationToPortal", () => {
  it("posts the certificate to the portal with the shared secret and records the outcome", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ status: "awarded", profile_id: "p-1", invited: true }), { status: 200 })
    );
    const result = await syncCertificationToPortal(fakeService("mosaic-practitioner"), "uc-1");
    expect(result).toMatchObject({ status: "awarded", profile_id: "p-1", invited: true });

    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(String(url)).toBe("https://portal.example/api/integrations/lms/certifications");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer s3cret");
    expect(JSON.parse(String(init.body))).toEqual({
      email: "sam@example.com", first_name: "Sam", last_name: "Lee", certification: "mosaic-practitioner",
      issued_at: "2026-11-11T00:00:00Z", expires_at: "2031-11-11T00:00:00Z",
      verification_url: "https://learn.example/verify/LMS-AAAA", external_id: "uc-1",
    });
    // existing metadata kept, outcome added
    expect(saved).toMatchObject({ source: "capstone", portal_sync: { status: "awarded" } });
  });

  it("records a failure instead of throwing", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ error: "nope" }), { status: 500 }));
    const result = await syncCertificationToPortal(fakeService("mosaic-practitioner"), "uc-1");
    expect(result.status).toBe("failed");
    expect(saved).toMatchObject({ portal_sync: { status: "failed" } });
  });

  it("sends nothing for a certification the portal doesn't know", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    const result = await syncCertificationToPortal(fakeService(null), "uc-1");
    expect(result.status).toBe("not_applicable");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
