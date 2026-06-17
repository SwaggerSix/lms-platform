import { describe, it, expect } from "vitest";
import { storefrontNames } from "@/lib/courses/cover-provenance";

describe("storefrontNames", () => {
  // Regression: PostgREST returns the `products` embed as a single object (not
  // an array) because products.course_id is UNIQUE. The cover-log route used to
  // call `.map` on it and crash with HTTP 500.
  it("handles a single to-one product object", () => {
    expect(
      storefrontNames({ storefront: { name: "Gotham Government Services Training" } })
    ).toBe("Gotham Government Services Training");
  });

  it("handles an array of products", () => {
    expect(
      storefrontNames([
        { storefront: { name: "gothamCulture Training" } },
        { storefront: { name: "Gotham Government Services Training" } },
      ])
    ).toBe("gothamCulture Training, Gotham Government Services Training");
  });

  it("de-duplicates repeated storefront names", () => {
    expect(
      storefrontNames([
        { storefront: { name: "Store A" } },
        { storefront: { name: "Store A" } },
      ])
    ).toBe("Store A");
  });

  it("returns an empty string for null, empty, or storefront-less products", () => {
    expect(storefrontNames(null)).toBe("");
    expect(storefrontNames(undefined)).toBe("");
    expect(storefrontNames([])).toBe("");
    expect(storefrontNames({ storefront: null })).toBe("");
  });
});
