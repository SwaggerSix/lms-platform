import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Snapshot the non-cron, non-header fields of vercel.json so a
 * framework or region change lands as a deliberate diff. Cron
 * schedules are covered by vercel-crons; headers belong in
 * next.config.ts per header-parity.
 *
 * `$schema` is excluded — it's metadata for IDEs, not behavior.
 */

interface Vercel {
  framework?: string;
  regions?: string[];
  crons?: unknown;
  headers?: unknown;
  $schema?: string;
  [k: string]: unknown;
}

const vercel = JSON.parse(
  readFileSync(join(process.cwd(), "vercel.json"), "utf8")
) as Vercel;

describe("vercel.json config (non-cron)", () => {
  it("top-level keys are snapshotted", () => {
    const keys = Object.keys(vercel)
      .filter((k) => k !== "$schema")
      .sort();
    expect(keys).toMatchInlineSnapshot(`
      [
        "crons",
        "framework",
        "regions",
      ]
    `);
  });

  it("framework is nextjs", () => {
    expect(vercel.framework).toBe("nextjs");
  });

  it("regions is a single-region list", () => {
    expect(vercel.regions).toEqual(["iad1"]);
  });

  it("does not carry a `headers` field (next.config.ts owns them)", () => {
    // Regression guard for the Cache-Control override bug found
    // 2026-05-26. Adding a `headers` array here would re-introduce
    // the silent edge-level override that neutralized per-handler
    // jsonCached responses. header-parity also catches this; the
    // direct check stays as belt-and-suspenders.
    expect(vercel.headers).toBeUndefined();
  });
});
