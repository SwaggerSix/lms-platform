import { describe, it, expect } from "vitest";
import {
  mapAndDedupeCourses,
  shelfPriceOf,
  STOREFRONT_PROGRAM,
  type ProductRow,
} from "@/lib/integrations/partner-portal/courses";

const p = (over: Partial<ProductRow> & { id: string }): ProductRow => ({
  name: "Course",
  description: null,
  sku: null,
  storefront: { slug: "gothamculture" },
  ...over,
});

describe("STOREFRONT_PROGRAM", () => {
  it("maps the two Gotham storefront slugs to programs", () => {
    expect(STOREFRONT_PROGRAM.gothamculture).toBe("gc");
    expect(STOREFRONT_PROGRAM.gothamgovernment).toBe("ggs");
  });
});

describe("mapAndDedupeCourses", () => {
  it("maps product fields to the canonical course shape", () => {
    const out = mapAndDedupeCourses([
      p({ id: "1", name: "Coaching Skills", description: "desc", sku: "GC-01", storefront: { slug: "gothamculture" } }),
    ]);
    expect(out).toEqual([
      { lms_course_id: "1", program: "gc", title: "Coaching Skills", code: "GC-01", description: "desc", active: true, shelf_price: null },
    ]);
  });

  it("derives ggs from the gothamgovernment storefront", () => {
    const out = mapAndDedupeCourses([
      p({ id: "2", name: "Federal Appropriations Law", storefront: { slug: "gothamgovernment" } }),
    ]);
    expect(out[0].program).toBe("ggs");
  });

  it("dedupes a course mirrored into both storefronts, gc wins", () => {
    const out = mapAndDedupeCourses([
      p({ id: "ggs-id", name: "Negotiation Skills", storefront: { slug: "gothamgovernment" } }),
      p({ id: "gc-id", name: "Negotiation Skills", storefront: { slug: "gothamculture" } }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].program).toBe("gc");
    expect(out[0].lms_course_id).toBe("gc-id");
  });

  it("dedupes case-insensitively by title", () => {
    const out = mapAndDedupeCourses([
      p({ id: "a", name: "Time Management", storefront: { slug: "gothamgovernment" } }),
      p({ id: "b", name: "time management", storefront: { slug: "gothamculture" } }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].program).toBe("gc");
  });

  it("skips rows with no recognized storefront or empty title", () => {
    const out = mapAndDedupeCourses([
      p({ id: "x", name: "  ", storefront: { slug: "gothamculture" } }),
      p({ id: "y", name: "Ghost", storefront: { slug: "some-other-store" } }),
      p({ id: "z", name: "Real", storefront: null }),
    ]);
    expect(out).toEqual([]);
  });

  it("handles the PostgREST to-one embed returned as an array", () => {
    const out = mapAndDedupeCourses([
      p({ id: "1", name: "Team Building", storefront: [{ slug: "gothamgovernment" }] }),
    ]);
    expect(out[0].program).toBe("ggs");
  });

  it("normalizes an empty sku to null", () => {
    const out = mapAndDedupeCourses([p({ id: "1", name: "X", sku: "  " })]);
    expect(out[0].code).toBeNull();
  });

  it("returns courses sorted by title", () => {
    const out = mapAndDedupeCourses([
      p({ id: "1", name: "Zebra" }),
      p({ id: "2", name: "Alpha" }),
    ]);
    expect(out.map((c) => c.title)).toEqual(["Alpha", "Zebra"]);
  });

  it("sends the product price as the shelf price", () => {
    const out = mapAndDedupeCourses([p({ id: "1", name: "Listening", price: 2400 })]);
    expect(out[0].shelf_price).toBe(2400);
  });

  it("treats a 0 or missing price as not priced", () => {
    const out = mapAndDedupeCourses([
      p({ id: "1", name: "A", price: 0 }),
      p({ id: "2", name: "B", price: null }),
      p({ id: "3", name: "C" }),
    ]);
    expect(out.map((c) => c.shelf_price)).toEqual([null, null, null]);
  });

  it("keeps the gc listing but takes the ggs price when only that one is priced", () => {
    const out = mapAndDedupeCourses([
      p({ id: "gc-id", name: "Negotiation Skills", storefront: { slug: "gothamculture" }, price: 0 }),
      p({ id: "ggs-id", name: "Negotiation Skills", storefront: { slug: "gothamgovernment" }, price: "1850.00" }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].lms_course_id).toBe("gc-id");
    expect(out[0].shelf_price).toBe(1850);
  });

  it("prefers the winning listing's own price when both are priced", () => {
    const out = mapAndDedupeCourses([
      p({ id: "ggs-id", name: "Negotiation Skills", storefront: { slug: "gothamgovernment" }, price: 1850 }),
      p({ id: "gc-id", name: "Negotiation Skills", storefront: { slug: "gothamculture" }, price: 2000 }),
    ]);
    expect(out[0].lms_course_id).toBe("gc-id");
    expect(out[0].shelf_price).toBe(2000);
  });
});

describe("shelfPriceOf", () => {
  it("accepts positive numbers and numeric strings", () => {
    expect(shelfPriceOf(2400)).toBe(2400);
    expect(shelfPriceOf("1850.50")).toBe(1850.5);
  });

  it("returns null for zero, negatives, junk and missing", () => {
    for (const v of [0, -1, "abc", null, undefined]) expect(shelfPriceOf(v)).toBeNull();
  });
});
