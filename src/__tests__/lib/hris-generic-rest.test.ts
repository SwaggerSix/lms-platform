import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GenericRESTProvider } from "@/lib/integrations/hris/providers";

/**
 * Tests the GenericREST provider's response→HRISEmployee mapping:
 * results_path navigation, default + custom field maps, external_id
 * stringification, status normalization, and the email/external_id
 * filter. `fetch` is mocked.
 */

function mockFetch(body: unknown, init: { ok?: boolean; status?: number; statusText?: string } = {}) {
  const { ok = true, status = 200, statusText = "OK" } = init;
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok,
      status,
      statusText,
      json: async () => body,
    })
  );
}

const provider = new GenericRESTProvider();
const cfg = (over: Record<string, unknown> = {}) => ({ api_url: "https://hris.example/api", ...over });

describe("GenericRESTProvider.testConnection", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("fails fast when api_url is missing", async () => {
    const r = await provider.testConnection({} as never);
    expect(r.success).toBe(false);
    expect(r.message).toMatch(/api_url is required/);
  });

  it("succeeds on an ok response", async () => {
    mockFetch({});
    expect((await provider.testConnection(cfg() as never)).success).toBe(true);
  });

  it("reports the HTTP status on a non-ok response", async () => {
    mockFetch({}, { ok: false, status: 503, statusText: "Service Unavailable" });
    const r = await provider.testConnection(cfg() as never);
    expect(r.success).toBe(false);
    expect(r.message).toMatch(/503/);
  });
});

describe("GenericRESTProvider.fetchEmployees", () => {
  beforeEach(() =>
    vi.stubGlobal("fetch", vi.fn())
  );
  afterEach(() => vi.unstubAllGlobals());

  it("maps default fields and stringifies a numeric external_id", async () => {
    mockFetch([
      { id: 1234, email: "a@x.com", first_name: "A", last_name: "B", status: "Active" },
    ]);
    const [e] = await provider.fetchEmployees(cfg() as never);
    expect(e.external_id).toBe("1234");
    expect(e.email).toBe("a@x.com");
    expect(e.status).toBe("active");
  });

  it("navigates results_path to find the records array", async () => {
    mockFetch({ data: { employees: [{ id: "9", email: "z@x.com" }] } });
    const out = await provider.fetchEmployees(cfg({ results_path: "data.employees" }) as never);
    expect(out).toHaveLength(1);
    expect(out[0].external_id).toBe("9");
  });

  it("normalizes any non-'active' status to 'inactive' and defaults missing to 'active'", async () => {
    mockFetch([
      { id: "1", email: "a@x.com", status: "Terminated" },
      { id: "2", email: "b@x.com" },
    ]);
    const out = await provider.fetchEmployees(cfg() as never);
    expect(out[0].status).toBe("inactive");
    expect(out[1].status).toBe("active");
  });

  it("drops records missing email or external_id", async () => {
    mockFetch([
      { id: "1", email: "ok@x.com" },
      { id: "2" }, // no email
      { email: "noid@x.com" }, // no id
    ]);
    const out = await provider.fetchEmployees(cfg() as never);
    expect(out.map((e) => e.external_id)).toEqual(["1"]);
  });

  it("honors a custom field_map (source key → target)", async () => {
    mockFetch([{ emp_id: "77", work_email: "c@x.com" }]);
    const out = await provider.fetchEmployees(
      cfg({ field_map: { emp_id: "external_id", work_email: "email" } }) as never
    );
    expect(out[0].external_id).toBe("77");
    expect(out[0].email).toBe("c@x.com");
  });

  it("throws when results_path doesn't resolve to an array", async () => {
    mockFetch({ data: { employees: { not: "an array" } } });
    await expect(
      provider.fetchEmployees(cfg({ results_path: "data.employees" }) as never)
    ).rejects.toThrow(/Expected an array/);
  });

  it("throws on a non-ok HTTP response", async () => {
    mockFetch({}, { ok: false, status: 500, statusText: "Server Error" });
    await expect(provider.fetchEmployees(cfg() as never)).rejects.toThrow(/REST API error: 500/);
  });
});
