import { describe, it, expect } from "vitest";
import { deepMergePreferences } from "@/lib/preferences/merge";

describe("deepMergePreferences", () => {
  it("returns a copy of current when incoming is empty", () => {
    const cur = { a: 1, b: { c: 2 } };
    const out = deepMergePreferences(cur, {});
    expect(out).toEqual(cur);
    expect(out).not.toBe(cur); // copy, not reference
  });

  it("adds new top-level keys without disturbing existing ones", () => {
    const out = deepMergePreferences({ a: 1 }, { b: 2 });
    expect(out).toEqual({ a: 1, b: 2 });
  });

  it("overwrites primitives at any depth", () => {
    const out = deepMergePreferences({ a: 1, b: "old" }, { a: 99, b: "new" });
    expect(out).toEqual({ a: 99, b: "new" });
  });

  it("merges nested objects at every depth", () => {
    const cur = {
      ui_prefs: { theme: { colors: { primary: "blue", secondary: "green" } } },
      notifications: { email: true },
    };
    const out = deepMergePreferences(cur, {
      ui_prefs: { theme: { colors: { primary: "red" } } },
    });
    expect(out).toEqual({
      ui_prefs: { theme: { colors: { primary: "red", secondary: "green" } } },
      notifications: { email: true },
    });
  });

  it("treats arrays as overwrite (not merge)", () => {
    const out = deepMergePreferences({ tags: ["a", "b"] }, { tags: ["c"] });
    expect(out.tags).toEqual(["c"]);
  });

  it("incoming null overwrites (lets caller delete a preference)", () => {
    const out = deepMergePreferences({ removed: { k: 1 } }, { removed: null });
    expect(out.removed).toBeNull();
  });

  it("does not mutate the original 'current' object", () => {
    const cur = { ui_prefs: { theme: "light" } };
    const snapshot = JSON.stringify(cur);
    deepMergePreferences(cur, { ui_prefs: { theme: "dark" } });
    expect(JSON.stringify(cur)).toBe(snapshot);
  });

  it("does not mutate the original 'incoming' object", () => {
    const inc = { ui_prefs: { theme: "dark" } };
    const snapshot = JSON.stringify(inc);
    deepMergePreferences({ ui_prefs: { theme: "light" } }, inc);
    expect(JSON.stringify(inc)).toBe(snapshot);
  });

  it("scalar in current overwritten by object in incoming", () => {
    // Edge case: current has a primitive, incoming has an object —
    // object wins (incoming value type takes precedence).
    const out = deepMergePreferences({ x: 5 }, { x: { y: 1 } });
    expect(out).toEqual({ x: { y: 1 } });
  });

  it("object in current overwritten by scalar in incoming", () => {
    const out = deepMergePreferences({ x: { y: 1 } }, { x: 5 });
    expect(out).toEqual({ x: 5 });
  });
});
