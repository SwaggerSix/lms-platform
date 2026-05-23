import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

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
 * Enforced: every GET route handler under src/app/api/ must explicitly
 * choose a Cache-Control posture by returning through jsonCached,
 * jsonNoStore, or by setting a Cache-Control header on its
 * NextResponse.json call. Bare NextResponse.json in a GET inherits the
 * framework default and leaves cacheability ambiguous.
 *
 * This was originally an advisory ratchet that allowed the legacy
 * backlog to drain over time. Backlog hit zero on 2026-05-23, so the
 * test now hard-fails on any unclassified GET.
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

describe("GET cache-control audit (enforced)", () => {
  it("every GET handler is classified — no bare NextResponse.json returns", () => {
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

    expect(
      unclassified,
      `Found unclassified GET handlers. Each must return via jsonCached / jsonNoStore or set Cache-Control explicitly: ${JSON.stringify(unclassified, null, 2)}`
    ).toEqual([]);
  });
});
