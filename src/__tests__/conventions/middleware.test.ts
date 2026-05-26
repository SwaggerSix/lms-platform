import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * src/middleware.ts runs on every non-static request (per its
 * `config.matcher`). Changes here affect authentication and route
 * gating site-wide; pin the load-bearing pieces:
 *
 *   - the matcher (which paths the middleware applies to)
 *   - the protected-path prefixes (/admin, /manager)
 *   - the role lists for each protected branch
 *
 * Full-file snapshot would be too churny; this picks out the
 * specific assertions that matter.
 */

const source = readFileSync(join(process.cwd(), "src/middleware.ts"), "utf8");

describe("src/middleware.ts", () => {
  it("matcher excludes static assets and image files", () => {
    // The matcher carries a single regex string. Pin the
    // recognizable pieces rather than the full thing — the
    // exact characters get tricky to escape twice.
    expect(source).toContain("matcher:");
    expect(source).toContain("_next/static");
    expect(source).toContain("_next/image");
    expect(source).toContain("favicon.ico");
    for (const ext of ["svg", "png", "jpg", "jpeg", "gif", "webp"]) {
      expect(source, `matcher excludes .${ext}`).toContain(ext);
    }
  });

  it("gates /admin via the isAdmin helper", () => {
    expect(source).toMatch(
      /pathname\.startsWith\("\/admin"\)[\s\S]{0,100}!isAdmin\(role\)/
    );
  });

  it("gates /manager via the isManagerOrAbove helper", () => {
    expect(source).toMatch(
      /pathname\.startsWith\("\/manager"\)[\s\S]{0,100}!isManagerOrAbove\(role\)/
    );
  });

  it("redirects unauthorized role to /dashboard", () => {
    // Two branches (admin + manager) each set url.pathname =
    // "/dashboard". A future change that routes to a different
    // path (e.g. /login or /unauthorized) shows up here.
    const matches = source.match(/url\.pathname\s*=\s*"\/dashboard"/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });
});
