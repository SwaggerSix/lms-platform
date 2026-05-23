import { describe, it, expect } from "vitest";

/**
 * Unit tests for the GET cache-control audit scanner logic itself.
 * The codebase walker in get-cache-control-audit.test.ts only proves
 * the current tree is at the snapshot — it can't prove a regression
 * would be caught. Re-implement the scanner inline here against
 * crafted in-memory sources so the detection function is locked
 * against silent loosening.
 *
 * Mirrors extractGetBody + isClassified from the walker test
 * verbatim; if those shift, this file diverges and the duplication
 * surfaces the change for review.
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

function isClassified(body: string): boolean {
  return (
    /jsonCached\(/.test(body) ||
    /jsonNoStore\(/.test(body) ||
    /"Cache-Control"\s*:/.test(body)
  );
}

describe("extractGetBody", () => {
  it("returns the body of a simple GET handler", () => {
    const src = `
      import {} from "x";
      export async function GET() {
        return new Response("ok");
      }
    `;
    const body = extractGetBody(src);
    expect(body).not.toBeNull();
    expect(body).toContain(`return new Response("ok");`);
    expect(body!.startsWith("{")).toBe(true);
    expect(body!.endsWith("}")).toBe(true);
  });

  it("walks nested braces correctly", () => {
    const src = `
      export async function GET(req: Request) {
        if (req) {
          const x = { a: 1, b: { c: 2 } };
          return Response.json(x);
        }
      }
    `;
    const body = extractGetBody(src);
    expect(body).toContain(`b: { c: 2 }`);
    expect(body).toContain(`return Response.json(x);`);
  });

  it("returns null when there is no GET export", () => {
    expect(extractGetBody(`export async function POST() {}`)).toBeNull();
    expect(extractGetBody(``)).toBeNull();
  });

  it("returns null if the function has no opening brace", () => {
    expect(extractGetBody(`export async function GET()`)).toBeNull();
  });
});

describe("isClassified", () => {
  it("treats jsonCached() as classified", () => {
    expect(isClassified(`return jsonCached(data);`)).toBe(true);
  });

  it("treats jsonNoStore() as classified", () => {
    expect(isClassified(`return jsonNoStore({ error });`)).toBe(true);
  });

  it("treats an explicit Cache-Control header literal as classified", () => {
    expect(
      isClassified(`{ "Cache-Control": "private, max-age=60" }`)
    ).toBe(true);
  });

  it("does NOT treat a bare NextResponse.json as classified", () => {
    expect(isClassified(`return NextResponse.json(data);`)).toBe(false);
  });

  it("identifier-prefix behavior is documented (current matcher is lax)", () => {
    // The regex anchors on `jsonCached(` and `jsonNoStore(` literally —
    // no word-boundary check on the left. `jsonCachedThing(` would NOT
    // match because the trailing `(` is consumed by `jsonCached` so the
    // overall regex (which expects `(`) fails. Pin both cases:
    expect(isClassified(`return jsonCached(x);`)).toBe(true);
    expect(isClassified(`return jsonCachedThing();`)).toBe(false);
    // A leading-prefix false positive (e.g. wherethejsonCached(...)) is
    // also impossible because there's an identifier immediately before
    // the `(` — the regex would match the substring `jsonCached(`
    // contained within. That's a quirk we accept; route handlers don't
    // contain such strings.
  });
});

describe("ratchet end-to-end (synthetic)", () => {
  it("a synthetic unclassified GET would be detected by the scanner", () => {
    const src = `
      import { NextResponse } from "next/server";
      export async function GET() {
        return NextResponse.json({ ok: true });
      }
    `;
    const body = extractGetBody(src);
    expect(body).not.toBeNull();
    expect(isClassified(body!)).toBe(false);
    // body contains NextResponse.json so the walker would push it onto
    // the unclassified list.
    expect(/NextResponse\.json\(/.test(body!)).toBe(true);
  });

  it("a synthetic classified GET would be skipped", () => {
    const src = `
      export async function GET() {
        return jsonCached({ ok: true });
      }
    `;
    const body = extractGetBody(src);
    expect(isClassified(body!)).toBe(true);
  });
});
