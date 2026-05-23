import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import ratchet from "./audit-ratchet.json";

function walkTs(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) out.push(...walkTs(p));
    else if (s.isFile() && p.endsWith(".ts")) out.push(p);
  }
  return out;
}

/**
 * Advisory audit: every GET route handler should explicitly choose a
 * Cache-Control posture by returning through jsonCached, jsonNoStore,
 * or by setting a Cache-Control header on its NextResponse.json call.
 * Bare NextResponse.json in a GET inherits the framework default and
 * leaves cacheability ambiguous.
 *
 * The scanner returns an "unclassified" list. ENFORCED endpoints have
 * been audited and should never regress; UNCLASSIFIED endpoints are
 * legacy GETs that haven't been triaged yet. The test passes as long
 * as the live set of unclassified endpoints matches the SNAPSHOT — so
 * any new GET route is forced through the choice up-front, but the
 * legacy backlog doesn't block CI.
 */

function extractGetBody(source: string): string | null {
  const RE = /export async function GET\s*\(/g;
  const m = RE.exec(source);
  if (!m) return null;
  // Walk to opening brace of function body.
  let i = m.index + m[0].length;
  let parenDepth = 1;
  while (i < source.length && parenDepth > 0) {
    const ch = source[i];
    if (ch === "(") parenDepth++;
    else if (ch === ")") parenDepth--;
    i++;
  }
  while (i < source.length && source[i] !== "{") i++;
  if (i >= source.length) return null;
  const start = i;
  let depth = 0;
  for (; i < source.length; i++) {
    const ch = source[i];
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  return null;
}

function isClassified(body: string): boolean {
  return (
    /jsonCached\(/.test(body) ||
    /jsonNoStore\(/.test(body) ||
    /"Cache-Control"\s*:/.test(body)
  );
}

describe("GET cache-control audit (advisory)", () => {
  it("reports the unclassified GET set so new GETs are forced to choose", () => {
    const files = walkTs(join(process.cwd(), "src/app/api"));
    const unclassified: string[] = [];

    for (const file of files) {
      const source = readFileSync(file, "utf8");
      if (!/export async function GET\s*\(/.test(source)) continue;
      const body = extractGetBody(source);
      if (!body) continue;
      if (isClassified(body)) continue;
      // Only flag handlers that actually call NextResponse.json — a
      // streaming/binary GET is its own thing and falls outside this
      // convention.
      if (!/NextResponse\.json\(/.test(body)) continue;
      unclassified.push(file.replace(process.cwd() + "/", ""));
    }

    unclassified.sort();

    // Ratchet: backlog can only shrink. The hard ceiling lives in
    // audit-ratchet.json so updates show up as a single-line diff in
    // PRs (rather than buried in a TS edit). Lower the number each
    // time the snapshot shrinks; once it hits 0 the ratchet can be
    // removed and this test can flip to `toEqual([])`.
    const MAX_UNCLASSIFIED = ratchet.max_unclassified;
    expect(unclassified.length, `Unclassified GET handlers: ${unclassified.length} (ceiling ${MAX_UNCLASSIFIED}). Classify the new endpoint via jsonCached/jsonNoStore or lower max_unclassified in audit-ratchet.json.`).toBeLessThanOrEqual(MAX_UNCLASSIFIED);

    // Snapshot the current backlog. New GETs landing here force a
    // conscious choice; removing an endpoint from the list (because it
    // was classified) requires updating the snapshot in the same commit.
    expect(unclassified).toMatchInlineSnapshot(`
      [
        "src/app/api/admin/lrs/route.ts",
        "src/app/api/assessments/[id]/route.ts",
        "src/app/api/automation/rules/[id]/logs/route.ts",
        "src/app/api/automation/rules/[id]/route.ts",
        "src/app/api/chat/sessions/[id]/route.ts",
        "src/app/api/chat/sessions/route.ts",
        "src/app/api/cron/compute-recommendations/route.ts",
        "src/app/api/cron/scheduled-reports/route.ts",
        "src/app/api/email/route.ts",
        "src/app/api/embed/[token]/route.ts",
        "src/app/api/feedback/cycles/[id]/nominations/route.ts",
        "src/app/api/feedback/cycles/[id]/report/route.ts",
        "src/app/api/gamification/route.ts",
        "src/app/api/integrations/external/[id]/logs/route.ts",
        "src/app/api/integrations/external/[id]/mappings/route.ts",
        "src/app/api/integrations/video/route.ts",
        "src/app/api/mentorship/match/route.ts",
        "src/app/api/mentorship/profiles/[id]/route.ts",
        "src/app/api/microlearning/nuggets/[id]/route.ts",
        "src/app/api/observations/[id]/route.ts",
        "src/app/api/observations/templates/[id]/route.ts",
        "src/app/api/observations/templates/route.ts",
        "src/app/api/paths/[id]/route.ts",
        "src/app/api/profile/skills/route.ts",
        "src/app/api/tenants/[id]/branding/route.ts",
        "src/app/api/tenants/[id]/courses/route.ts",
        "src/app/api/tenants/[id]/members/route.ts",
        "src/app/api/tenants/[id]/route.ts",
        "src/app/api/workflows/[id]/runs/route.ts",
        "src/app/api/workflows/[id]/steps/route.ts",
        "src/app/api/xapi/activities/profile/route.ts",
        "src/app/api/xapi/activities/state/route.ts",
        "src/app/api/xapi/statements/route.ts",
        "src/app/api/xr/content/[id]/route.ts",
        "src/app/api/xr/content/route.ts",
      ]
    `);
  });
});
