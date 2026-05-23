import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { walkFiles } from "@/lib/testing/walk";

/**
 * Convention: every GET route handler under src/app/api/ must
 * explicitly choose a Cache-Control posture — either route the
 * response through jsonCached (cacheable read, 30s default + Vary:
 * Cookie), jsonNoStore (user-mutable / live state), or set
 * Cache-Control explicitly. A bare NextResponse.json in a GET
 * inherits the framework default and leaves cacheability ambiguous.
 *
 * This test enforces the convention by walking every route.ts under
 * src/app/api/ and failing if any GET body lacks one of the three
 * markers. The detection helpers are mirrored in
 * src/__tests__/lib/get-cache-control-scanner.test.ts where the
 * regex behavior itself is unit-tested.
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
  // Word-boundary anchored so identifier prefixes (e.g. a hypothetical
  // `jsonCachedThing(`) don't false-positive.
  return (
    /\bjsonCached\(/.test(body) ||
    /\bjsonNoStore\(/.test(body) ||
    /"Cache-Control"\s*:/.test(body)
  );
}

describe("GET cache-control audit (enforced)", () => {
  it("every GET handler is classified — no bare NextResponse.json returns", () => {
    const files = walkFiles(join(process.cwd(), "src/app/api"));
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

    expect(
      unclassified,
      `Found unclassified GET handlers. Each must return via jsonCached / jsonNoStore or set Cache-Control explicitly: ${JSON.stringify(unclassified, null, 2)}`
    ).toEqual([]);
  });
});
