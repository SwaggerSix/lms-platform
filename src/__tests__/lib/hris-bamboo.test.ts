import { describe, it, expect, vi, afterEach } from "vitest";
import { BambooHRProvider } from "@/lib/integrations/hris/providers";

/**
 * Tests BambooHRProvider.fetchEmployees field mapping: id→string,
 * workEmail/homeEmail fallback, supervisorEmail/supervisor fallback,
 * status normalization, and the no-email filter. `fetch` is mocked.
 */

function mockFetch(body: unknown, init: { ok?: boolean; status?: number; statusText?: string } = {}) {
  const { ok = true, status = 200, statusText = "OK" } = init;
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok, status, statusText, json: async () => body })
  );
}

const provider = new BambooHRProvider();
const cfg = { company_domain: "acme", api_key: "k" } as never;

describe("BambooHRProvider.fetchEmployees", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("maps directory fields to the HRISEmployee shape", async () => {
    mockFetch({
      employees: [
        {
          id: 42,
          workEmail: "w@x.com",
          firstName: "Grace",
          lastName: "Hopper",
          department: "Eng",
          jobTitle: "Admiral",
          supervisorEmail: "boss@x.com",
          hireDate: "2020-01-01",
          status: "Active",
        },
      ],
    });
    const [e] = await provider.fetchEmployees(cfg);
    expect(e).toEqual({
      external_id: "42",
      email: "w@x.com",
      first_name: "Grace",
      last_name: "Hopper",
      department: "Eng",
      job_title: "Admiral",
      manager_email: "boss@x.com",
      hire_date: "2020-01-01",
      status: "active",
    });
  });

  it("falls back to homeEmail and to supervisor when the primaries are absent", async () => {
    mockFetch({
      employees: [
        { id: 1, homeEmail: "home@x.com", supervisor: "Sup Name", status: "Active" },
      ],
    });
    const [e] = await provider.fetchEmployees(cfg);
    expect(e.email).toBe("home@x.com");
    expect(e.manager_email).toBe("Sup Name");
  });

  it("normalizes any non-'Active' status to 'inactive'", async () => {
    mockFetch({ employees: [{ id: 1, workEmail: "a@x.com", status: "Terminated" }] });
    const [e] = await provider.fetchEmployees(cfg);
    expect(e.status).toBe("inactive");
  });

  it("drops employees with no email (unusable for provisioning)", async () => {
    mockFetch({
      employees: [
        { id: 1, workEmail: "ok@x.com", status: "Active" },
        { id: 2, status: "Active" }, // no email
      ],
    });
    const out = await provider.fetchEmployees(cfg);
    expect(out.map((e) => e.external_id)).toEqual(["1"]);
  });

  it("throws on a non-ok HTTP response", async () => {
    mockFetch({}, { ok: false, status: 403, statusText: "Forbidden" });
    await expect(provider.fetchEmployees(cfg)).rejects.toThrow(/BambooHR API error: 403/);
  });
});
