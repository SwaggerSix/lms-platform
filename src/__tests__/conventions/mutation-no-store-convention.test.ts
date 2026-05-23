import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { walkFiles } from "@/lib/testing/walk";

/**
 * Every POST/PATCH/DELETE/PUT route handler must return through
 * jsonNoStore (or write its own Cache-Control header). A bare
 * NextResponse.json in a mutation body lets the browser cache the
 * response — fine for GETs, dangerous when the next read should see
 * the freshly-changed state.
 *
 * Carve-outs:
 *   - /api/reports/generate and /api/email return binary/streaming
 *     Responses, not JSON.
 *   - Authentication redirect responses that set cookies are wrapped
 *     in NextResponse.redirect(), which doesn't go through .json().
 *
 * The scanner walks each `export async function (POST|PATCH|DELETE|PUT)`
 * body and asserts no `NextResponse.json(` call appears inside. Bodies
 * are delimited by matching braces; nested arrow-function callbacks
 * (e.g. .then(() => NextResponse.json(...))) are still part of the
 * route's emitted response so they count.
 */

const ALLOWED = new Set<string>([
  // Carve-outs documented above. List file paths relative to repo root.
  // These endpoints return non-JSON bodies (binary report bytes,
  // email-send streaming responses) and use NextResponse.json only for
  // their auth/validation early-returns where no-store wrapping is
  // less critical.
  "src/app/api/email/route.ts",
  "src/app/api/reports/generate/route.ts",
]);

function extractMutationBodies(source: string): string[] {
  // Find each "export async function POST/PATCH/DELETE/PUT(" and walk
  // matching braces to capture the full body.
  const RE = /export async function (POST|PATCH|DELETE|PUT)\s*\(/g;
  const bodies: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = RE.exec(source))) {
    // Walk forward to the first '{' that opens the function body.
    let i = m.index + m[0].length;
    let parenDepth = 1;
    while (i < source.length && parenDepth > 0) {
      const ch = source[i];
      if (ch === "(") parenDepth++;
      else if (ch === ")") parenDepth--;
      i++;
    }
    while (i < source.length && source[i] !== "{") i++;
    if (i >= source.length) continue;
    const bodyStart = i;
    let depth = 0;
    for (; i < source.length; i++) {
      const ch = source[i];
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) {
          bodies.push(source.slice(bodyStart, i + 1));
          break;
        }
      }
    }
  }
  return bodies;
}

describe("mutation handlers don't bare NextResponse.json", () => {
  it("every POST/PATCH/DELETE/PUT body returns via jsonNoStore", () => {
    const files = walkFiles(join(process.cwd(), "src/app/api"));
    const offenders: Array<{ file: string; snippet: string }> = [];

    for (const file of files) {
      const rel = file.replace(process.cwd() + "/", "");
      if (ALLOWED.has(rel)) continue;
      const source = readFileSync(file, "utf8");
      const bodies = extractMutationBodies(source);
      for (const body of bodies) {
        if (/NextResponse\.json\(/.test(body)) {
          // Pull a short snippet around the first hit for actionable failure output.
          const idx = body.search(/NextResponse\.json\(/);
          const snippet = body.slice(Math.max(0, idx - 40), idx + 80).replace(/\s+/g, " ");
          offenders.push({ file: rel, snippet });
        }
      }
    }

    expect(
      offenders,
      `Offenders (use jsonNoStore instead): ${JSON.stringify(offenders, null, 2)}`
    ).toEqual([]);
  });
});
