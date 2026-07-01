import { describe, it, expect } from "vitest";
import {
  mapAndDedupeCourses,
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
      { lms_course_id: "1", program: "gc", title: "Coaching Skills", code: "GC-01", description: "desc", active: true },
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
});
