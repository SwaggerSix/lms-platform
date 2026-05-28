import { describe, it, expect } from "vitest";
import {
  FEATURE_CATALOG,
  FEATURE_KEYS,
  defaultFeatureMap,
  normalizeFeatures,
} from "@/lib/features/catalog";
import { getFeatureForPath } from "@/lib/features/routes";
import { resolveEnabledFeatures } from "@/lib/features/resolve";

describe("feature catalog", () => {
  it("has unique keys", () => {
    expect(new Set(FEATURE_KEYS).size).toBe(FEATURE_KEYS.length);
  });

  it("builds a default map covering every catalog key", () => {
    const map = defaultFeatureMap();
    expect(Object.keys(map).sort()).toEqual([...FEATURE_KEYS].sort());
    expect(map.self_registration).toBe(false);
    expect(map.gamification).toBe(true);
  });
});

describe("normalizeFeatures", () => {
  it("returns {} for nullish values", () => {
    expect(normalizeFeatures(null)).toEqual({});
    expect(normalizeFeatures(undefined)).toEqual({});
  });

  it("passes through the canonical map shape and coerces to boolean", () => {
    expect(normalizeFeatures({ gamification: false, ai_chat: 1 })).toEqual({
      gamification: false,
      ai_chat: true,
    });
  });

  it("maps the legacy array shape onto catalog keys", () => {
    const legacy = [
      { id: "1", name: "Gamification", enabled: false },
      { id: "4", name: "Self-Registration", enabled: true },
      { id: "evaluations", name: "Evaluations", enabled: false },
    ];
    expect(normalizeFeatures(legacy)).toEqual({
      gamification: false,
      self_registration: true,
      evaluations: false,
    });
  });

  it("prefers an explicit key over the display name in legacy entries", () => {
    expect(normalizeFeatures([{ key: "ecommerce", name: "Anything", enabled: false }])).toEqual({
      ecommerce: false,
    });
  });

  it("ignores legacy entries whose name maps to no known feature", () => {
    expect(normalizeFeatures([{ name: "Totally Unknown", enabled: true }])).toEqual({});
  });
});

describe("getFeatureForPath", () => {
  it("maps gated page routes", () => {
    expect(getFeatureForPath("/shop")).toBe("ecommerce");
    expect(getFeatureForPath("/shop/checkout")).toBe("ecommerce");
    expect(getFeatureForPath("/learn/chat")).toBe("ai_chat");
    expect(getFeatureForPath("/learn/paths/123")).toBe("learning_paths");
  });

  it("maps gated API routes", () => {
    expect(getFeatureForPath("/api/gamification/points")).toBe("gamification");
    expect(getFeatureForPath("/api/skills")).toBe("skills_tracking");
  });

  it("returns null for ungated paths", () => {
    expect(getFeatureForPath("/dashboard")).toBeNull();
    expect(getFeatureForPath("/learn/my-courses")).toBeNull();
    expect(getFeatureForPath("/api/courses")).toBeNull();
  });

  it("does not match on partial path segments", () => {
    // "/shopping" should not match the "/shop" prefix
    expect(getFeatureForPath("/shopping")).toBeNull();
  });
});

// Minimal fake Supabase client that returns canned rows per table.
function fakeClient(rows: { platform?: unknown; tenant?: unknown }) {
  return {
    from(table: string) {
      return {
        select() {
          return {
            eq() {
              return {
                single: async () => {
                  if (table === "platform_settings")
                    return { data: rows.platform ? { value: rows.platform } : null };
                  if (table === "tenants")
                    return { data: rows.tenant ? { features: rows.tenant } : null };
                  return { data: null };
                },
              };
            },
          };
        },
      };
    },
  };
}

describe("resolveEnabledFeatures", () => {
  it("falls back to catalog defaults with no overrides", async () => {
    const result = await resolveEnabledFeatures(fakeClient({}), null);
    expect(result.gamification).toBe(true);
    expect(result.self_registration).toBe(false);
  });

  it("applies platform overrides over catalog defaults", async () => {
    const result = await resolveEnabledFeatures(
      fakeClient({ platform: { gamification: false } }),
      null
    );
    expect(result.gamification).toBe(false);
  });

  it("lets tenant overrides win over platform overrides", async () => {
    const result = await resolveEnabledFeatures(
      fakeClient({ platform: { ai_chat: false }, tenant: { ai_chat: true } }),
      "tenant-1"
    );
    expect(result.ai_chat).toBe(true);
  });

  it("inherits the platform value when the tenant has no override for a key", async () => {
    const result = await resolveEnabledFeatures(
      fakeClient({ platform: { mentorship: false }, tenant: { gamification: false } }),
      "tenant-1"
    );
    expect(result.mentorship).toBe(false);
    expect(result.gamification).toBe(false);
  });

  it("normalizes a legacy platform array", async () => {
    const result = await resolveEnabledFeatures(
      fakeClient({ platform: [{ name: "Gamification", enabled: false }] }),
      null
    );
    expect(result.gamification).toBe(false);
  });
});

describe("catalog integrity", () => {
  it("every catalog entry has a non-empty name and description", () => {
    for (const f of FEATURE_CATALOG) {
      expect(f.name.length).toBeGreaterThan(0);
      expect(f.description.length).toBeGreaterThan(0);
    }
  });
});
