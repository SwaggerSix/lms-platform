import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { syncCertificationToPortal } from "@/lib/integrations/partner-portal/certification";

/**
 * Award / Revoke in the LMS → the partner portal badge
 * (gc-partner-portal /api/integrations/lms-certification).
 */

let row: Record<string, unknown> | null;
const service: any = {
  from: () => {
    const q: any = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: row, error: null }) };
    return q;
  },
};
const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  process.env.PARTNER_PORTAL_WRITEBACK_URL = "https://portal.example/api/integrations/profile-writeback";
  process.env.PROFILE_WRITEBACK_SECRET = "s3cret";
  row = {
    expires_at: "2031-11-11T12:00:00+00:00",
    user: { email: "pat@example.com", external_source: "partner_portal", external_id: "11111111-1111-4111-8111-111111111111" },
    certification: { capstone_key: "mosaic-practitioner" },
  };
});
afterEach(() => vi.unstubAllGlobals());

const reply = (status: number, body: unknown) => ({ ok: status < 400, status, json: async () => body });

describe("syncCertificationToPortal", () => {
  it("posts the credential, the portal profile id, email and expiry date with the write-back bearer", async () => {
    fetchMock.mockResolvedValue(reply(200, { status: "applied" }));
    expect(await syncCertificationToPortal(service, "uc1", "award")).toBe("updated");
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("https://portal.example/api/integrations/lms-certification");
    expect(init.headers.Authorization).toBe("Bearer s3cret");
    expect(JSON.parse(init.body)).toEqual({
      credential: "mosaic-practitioner",
      action: "award",
      external_id: "11111111-1111-4111-8111-111111111111",
      email: "pat@example.com",
      expires_at: "2031-11-11",
    });
  });

  it("sends no profile id for a learner who didn't come from the portal", async () => {
    row = { ...row!, user: { email: "x@example.com", external_source: null, external_id: "abc" } };
    fetchMock.mockResolvedValue(reply(200, { status: "not_a_partner" }));
    expect(await syncCertificationToPortal(service, "uc1", "revoke")).toBe("not_a_partner");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ external_id: null, action: "revoke" });
  });

  it("skips a course-completion certificate and reports a missing setup or a failure without throwing", async () => {
    row = { ...row!, certification: { capstone_key: null } };
    expect(await syncCertificationToPortal(service, "uc1", "award")).toBe("skipped");
    row = { ...row!, certification: { capstone_key: "surveycraft-specialist" } };
    delete process.env.PROFILE_WRITEBACK_SECRET;
    expect(await syncCertificationToPortal(service, "uc1", "award")).toBe("not_configured");
    process.env.PROFILE_WRITEBACK_SECRET = "s3cret";
    fetchMock.mockResolvedValue(reply(500, { error: "x" }));
    expect(await syncCertificationToPortal(service, "uc1", "award")).toBe("failed");
    fetchMock.mockRejectedValue(new Error("network"));
    expect(await syncCertificationToPortal(service, "uc1", "award")).toBe("failed");
    fetchMock.mockResolvedValue(reply(200, { status: "refused", reason: "company" }));
    expect(await syncCertificationToPortal(service, "uc1", "award")).toBe("refused");
  });
});
