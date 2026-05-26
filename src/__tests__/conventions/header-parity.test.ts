import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Security and cache headers can land in two places:
 *   - next.config.ts (set via the `async headers()` hook)
 *   - vercel.json (`headers` array)
 *
 * Both apply at the response layer. Overlap is risky:
 *   - Same header key in both → undefined precedence; depends on
 *     Vercel's merge order.
 *   - Cache-Control specifically gets contradictory if both files
 *     ship a value, since the per-handler `jsonCached` /
 *     `jsonNoStore` emit a third value at the function layer.
 *
 * Convention: security headers live in next.config.ts only.
 * vercel.json's `headers` array should not duplicate them. The
 * Cache-Control on /api/(.*) is the specific gotcha that motivated
 * this guard — a blanket no-store at the vercel edge would
 * override every jsonCached response.
 */

interface VercelHeaderRule {
  source: string;
  headers: Array<{ key: string; value: string }>;
}
interface Vercel {
  headers?: VercelHeaderRule[];
}

const vercel = JSON.parse(
  readFileSync(join(process.cwd(), "vercel.json"), "utf8")
) as Vercel;
const nextSource = readFileSync(join(process.cwd(), "next.config.ts"), "utf8");

describe("header parity (next.config.ts vs vercel.json)", () => {
  it("vercel.json does NOT set a blanket Cache-Control on /api/(.*)", () => {
    // Per-handler jsonCached/jsonNoStore are the source of truth
    // for API cacheability. A blanket Cache-Control at the vercel
    // edge would silently override every jsonCached(...) response.
    const apiRule = (vercel.headers ?? []).find((r) => r.source === "/api/(.*)");
    const cc = apiRule?.headers.find((h) => h.key === "Cache-Control");
    expect(
      cc,
      `vercel.json sets Cache-Control on /api/(.*) (${cc?.value}). Per-handler jsonCached responses would be overridden. Remove the rule and let handlers carry their own Cache-Control.`
    ).toBeUndefined();
  });

  it("security headers in vercel.json don't duplicate next.config.ts", () => {
    const securityHeaders = [
      "X-Content-Type-Options",
      "X-Frame-Options",
      "X-XSS-Protection",
      "Referrer-Policy",
      "Permissions-Policy",
      "Content-Security-Policy",
    ];
    const offenders: string[] = [];
    for (const rule of vercel.headers ?? []) {
      for (const h of rule.headers) {
        if (securityHeaders.includes(h.key) && nextSource.includes(h.key)) {
          offenders.push(`${rule.source} → ${h.key}`);
        }
      }
    }
    expect(
      offenders,
      `These headers are set in BOTH next.config.ts and vercel.json. Pick one (next.config.ts preferred — keeps the header source colocated with the request handling).`
    ).toEqual([]);
  });
});
