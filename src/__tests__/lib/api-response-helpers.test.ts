import { describe, it, expect } from "vitest";
import { jsonNoStore } from "@/lib/api/no-store";
import { jsonCached } from "@/lib/api/cached";

/**
 * jsonNoStore and jsonCached are the two response shorthands every
 * route handler uses; their header semantics determine browser caching
 * behavior across the API. Lock both helpers' wire output here so a
 * future "let me add a default" doesn't silently change cacheability.
 */

describe("jsonNoStore", () => {
  it("sets Cache-Control: private, no-store and defaults to 200", async () => {
    const res = jsonNoStore({ ok: true });
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(await res.json()).toEqual({ ok: true });
  });

  it("forwards status from init", () => {
    const res = jsonNoStore({ error: "nope" }, { status: 400 });
    expect(res.status).toBe(400);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
  });

  it("caller-supplied Cache-Control wins (escape hatch)", () => {
    const res = jsonNoStore(
      { ok: true },
      { headers: { "Cache-Control": "public, max-age=60" } }
    );
    expect(res.headers.get("cache-control")).toBe("public, max-age=60");
  });

  it("merges additional headers alongside Cache-Control", () => {
    const res = jsonNoStore({ ok: true }, { headers: { "X-Foo": "bar" } });
    expect(res.headers.get("x-foo")).toBe("bar");
    expect(res.headers.get("cache-control")).toBe("private, no-store");
  });
});

describe("jsonCached", () => {
  it("emits private + max-age + stale-while-revalidate + Vary: Cookie by default", () => {
    const res = jsonCached({ ok: true });
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe(
      "private, max-age=30, stale-while-revalidate=60"
    );
    expect(res.headers.get("vary")).toBe("Cookie");
  });

  it("honors custom maxAge and swr", () => {
    const res = jsonCached({ ok: true }, { maxAge: 5, swr: 15 });
    expect(res.headers.get("cache-control")).toBe(
      "private, max-age=5, stale-while-revalidate=15"
    );
  });

  it("caller-supplied Cache-Control and Vary win", () => {
    const res = jsonCached(
      { ok: true },
      { headers: { "Cache-Control": "public, max-age=300", Vary: "Cookie, Authorization" } }
    );
    expect(res.headers.get("cache-control")).toBe("public, max-age=300");
    expect(res.headers.get("vary")).toBe("Cookie, Authorization");
  });

  it("forwards status from options", () => {
    const res = jsonCached({ ok: true }, { status: 201 });
    expect(res.status).toBe(201);
  });

  it("preserves body shape", async () => {
    const res = jsonCached({ nested: { value: [1, 2, 3] } });
    expect(await res.json()).toEqual({ nested: { value: [1, 2, 3] } });
  });

  it("merges additional headers alongside cache directives", () => {
    const res = jsonCached({ ok: true }, { headers: { "X-Total": "42" } });
    expect(res.headers.get("x-total")).toBe("42");
    expect(res.headers.get("vary")).toBe("Cookie");
  });

  it("varyExtra: ['Authorization'] yields 'Cookie, Authorization'", () => {
    const res = jsonCached({ ok: true }, { varyExtra: ["Authorization"] });
    expect(res.headers.get("vary")).toBe("Cookie, Authorization");
  });

  it("varyExtra dedupes against Cookie and itself (case-insensitive)", () => {
    const res = jsonCached(
      { ok: true },
      { varyExtra: ["cookie", "Authorization", "AUTHORIZATION", "X-Tenant-Id"] }
    );
    expect(res.headers.get("vary")).toBe("Cookie, Authorization, X-Tenant-Id");
  });

  it("caller-supplied Vary header trumps varyExtra (escape hatch)", () => {
    const res = jsonCached(
      { ok: true },
      { varyExtra: ["Authorization"], headers: { Vary: "Accept-Language" } }
    );
    expect(res.headers.get("vary")).toBe("Accept-Language");
  });
});
