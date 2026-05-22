import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * logAudit warns on non-conformant action strings (e.g. snake_case
 * without a dot) but still attempts the insert. Tests pin both
 * branches so a future "throw instead" change is intentional.
 */

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({
    from: () => ({
      insert: () => Promise.resolve({ error: null }),
    }),
  }),
}));

describe("logAudit runtime convention guard", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it("does not warn for a legacy verb", async () => {
    const { logAudit } = await import("@/lib/audit");
    await logAudit({ action: "created", entityType: "course", entityId: "c1" });
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("does not warn for a dotted namespace", async () => {
    const { logAudit } = await import("@/lib/audit");
    await logAudit({ action: "replay.cron_alerts.refresh-view", entityType: "cron" });
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("warns for bare snake_case action", async () => {
    const { logAudit } = await import("@/lib/audit");
    await logAudit({ action: "manual_thing", entityType: "x" });
    expect(warnSpy).toHaveBeenCalled();
    const msg = warnSpy.mock.calls[0]?.[0] as string;
    expect(msg).toContain("manual_thing");
  });

  it("warns for camelCase action", async () => {
    const { logAudit } = await import("@/lib/audit");
    await logAudit({ action: "doThing", entityType: "x" });
    expect(warnSpy).toHaveBeenCalled();
  });

  it("silences the warning in production (NODE_ENV=production)", async () => {
    const orig = process.env.NODE_ENV;
    (process.env as Record<string, string>).NODE_ENV = "production";
    try {
      vi.resetModules();
      const { logAudit } = await import("@/lib/audit");
      await logAudit({ action: "manual_thing", entityType: "x" });
      expect(warnSpy).not.toHaveBeenCalled();
    } finally {
      (process.env as Record<string, string>).NODE_ENV = orig ?? "test";
      vi.resetModules();
    }
  });
});
