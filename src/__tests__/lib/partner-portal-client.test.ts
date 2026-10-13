// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { partnerPortalClient } from "@/lib/integrations/partner-portal/client";
import { encryptSecret, maskConfigSecrets, SECRET_MASK } from "@/lib/security/secret-crypto";

const config = { api_base: "https://partners.example.com", api_secret: "s3cret" };

describe("partnerPortalClient.fetchGemsInstructorLinks", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("reads the portal's GEMS instructor mapping with the sync secret", async () => {
    const fetchMock = vi.fn(async () => Response.json({ links: [{ gems_instructor_id: 7, profile_id: "p1" }] }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await partnerPortalClient.fetchGemsInstructorLinks(config)).toEqual([{ gems_instructor_id: 7, profile_id: "p1" }]);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [URL, RequestInit];
    expect(String(url)).toBe("https://partners.example.com/api/integrations/lms/gems-instructors");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer s3cret");
  });

  it("decrypts a sync secret stored encrypted", async () => {
    vi.stubEnv("INTEGRATION_ENCRYPTION_KEY", "test-key");
    const fetchMock = vi.fn(async () => Response.json({ links: [] }));
    vi.stubGlobal("fetch", fetchMock);
    await partnerPortalClient.fetchGemsInstructorLinks({ ...config, api_secret: encryptSecret("s3cret") });
    const [, init] = fetchMock.mock.calls[0] as unknown as [URL, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer s3cret");
  });

  it("tells an admin when the portal rejects the secret", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("Unauthorized", { status: 401 })));
    const result = await partnerPortalClient.testConnection(config);
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/must match LMS_SYNC_API_SECRET/);
  });

  it("reports a working connection", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ links: [{ gems_instructor_id: 7, profile_id: "p1" }] })));
    expect(await partnerPortalClient.testConnection(config)).toEqual({
      success: true,
      message: "Connected to the partner portal (1 GEMS instructor link)",
    });
  });
});

describe("the partner portal sync secret is a secret", () => {
  it("is masked in admin API responses", () => {
    expect(maskConfigSecrets({ api_base: "https://partners.example.com", api_secret: "s3cret" })).toEqual({
      api_base: "https://partners.example.com",
      api_secret: SECRET_MASK,
    });
  });
});
