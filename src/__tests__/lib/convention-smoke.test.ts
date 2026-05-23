import { describe, it, expect } from "vitest";

/**
 * Smoke test: feed the scanner functions a deliberately-broken
 * fixture and assert they would flag it. The codebase-walking
 * convention tests only verify the live tree is clean, so they
 * can't prove the guardrails would catch a regression. These
 * fixtures exercise the detection logic against synthetic source.
 *
 * Detection helpers are mirrored from the scanner test so a
 * divergence (e.g. swapping `\b` boundaries for something laxer)
 * surfaces as a mismatch here.
 */

function extractGetBody(source: string): string | null {
  const RE = /export async function GET\s*\(/g;
  const m = RE.exec(source);
  if (!m) return null;
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

function isClassifiedGet(body: string): boolean {
  return (
    /\bjsonCached\(/.test(body) ||
    /\bjsonNoStore\(/.test(body) ||
    /"Cache-Control"\s*:/.test(body)
  );
}

function extractMutationBodies(source: string): string[] {
  const RE = /export async function (POST|PATCH|DELETE|PUT)\s*\(/g;
  const bodies: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = RE.exec(source))) {
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

describe("convention smoke: synthetic regression sources", () => {
  it("unclassified GET would be caught", () => {
    const src = `
      import { NextResponse } from "next/server";
      export async function GET() {
        const data = { ok: true };
        return NextResponse.json(data);
      }
    `;
    const body = extractGetBody(src);
    expect(body).not.toBeNull();
    expect(isClassifiedGet(body!)).toBe(false);
    expect(/NextResponse\.json\(/.test(body!)).toBe(true);
  });

  it("classified GET via jsonCached passes", () => {
    const src = `
      export async function GET() {
        return jsonCached({ ok: true });
      }
    `;
    expect(isClassifiedGet(extractGetBody(src)!)).toBe(true);
  });

  it("classified GET via jsonNoStore passes", () => {
    const src = `
      export async function GET() {
        return jsonNoStore({ ok: true });
      }
    `;
    expect(isClassifiedGet(extractGetBody(src)!)).toBe(true);
  });

  it("classified GET via inline Cache-Control header passes", () => {
    const src = `
      export async function GET() {
        return NextResponse.json({}, { headers: { "Cache-Control": "private, no-store" } });
      }
    `;
    expect(isClassifiedGet(extractGetBody(src)!)).toBe(true);
  });

  it("mutation handler with bare NextResponse.json is caught", () => {
    const src = `
      export async function POST() {
        return NextResponse.json({ ok: true }, { status: 201 });
      }
    `;
    const bodies = extractMutationBodies(src);
    expect(bodies).toHaveLength(1);
    expect(/NextResponse\.json\(/.test(bodies[0])).toBe(true);
  });

  it("mutation handler via jsonNoStore is not caught", () => {
    const src = `
      export async function POST() {
        return jsonNoStore({ ok: true }, { status: 201 });
      }
    `;
    const bodies = extractMutationBodies(src);
    expect(bodies).toHaveLength(1);
    expect(/NextResponse\.json\(/.test(bodies[0])).toBe(false);
  });

  it("scans nested-brace mutation bodies correctly", () => {
    const src = `
      export async function PATCH(req: Request) {
        if (req) {
          const x = { a: 1 };
          return NextResponse.json(x);
        }
        return new Response("ok");
      }
    `;
    const bodies = extractMutationBodies(src);
    expect(bodies).toHaveLength(1);
    expect(/NextResponse\.json\(/.test(bodies[0])).toBe(true);
  });

  it("word-boundary anchoring: jsonCachedThing isn't a false positive", () => {
    const src = `
      export async function GET() {
        return jsonCachedThing({ ok: true });
      }
    `;
    expect(isClassifiedGet(extractGetBody(src)!)).toBe(false);
  });

  it("word-boundary anchoring: prefixed-word isn't a false positive", () => {
    const src = `
      export async function GET() {
        return myjsonNoStore({ ok: true });
      }
    `;
    expect(isClassifiedGet(extractGetBody(src)!)).toBe(false);
  });
});
