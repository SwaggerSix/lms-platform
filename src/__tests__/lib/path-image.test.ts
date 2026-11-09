import { describe, it, expect } from "vitest";
import { isValidPathImageUrl, parsePathImageInput, hasPathImage } from "@/lib/paths/path-image";

describe("isValidPathImageUrl", () => {
  it("accepts https URLs and same-origin paths", () => {
    expect(isValidPathImageUrl("https://proj.supabase.co/storage/v1/object/public/course-images/paths/a.jpg")).toBe(true);
    expect(isValidPathImageUrl("/images/paths/mosaic-certification.jpg")).toBe(true);
  });

  it("refuses everything else", () => {
    for (const bad of [
      "",
      "   ",
      "http://example.com/a.jpg",
      "javascript:alert(1)",
      "data:image/png;base64,AAAA",
      "//evil.example/a.jpg",
      "/\\evil.example/a.jpg",
      "images/a.jpg",
      "https://example.com/a b.jpg",
      "/" + "a".repeat(2048),
    ]) {
      expect(isValidPathImageUrl(bad)).toBe(false);
    }
  });
});

describe("parsePathImageInput", () => {
  it("passes undefined through, clears on null/empty, trims valid values", () => {
    expect(parsePathImageInput(undefined)).toEqual({ ok: true, value: undefined });
    expect(parsePathImageInput(null)).toEqual({ ok: true, value: null });
    expect(parsePathImageInput("  ")).toEqual({ ok: true, value: null });
    expect(parsePathImageInput(" /images/paths/x.jpg ")).toEqual({ ok: true, value: "/images/paths/x.jpg" });
  });

  it("rejects non-strings and unsafe URLs", () => {
    expect(parsePathImageInput(42).ok).toBe(false);
    expect(parsePathImageInput("javascript:alert(1)").ok).toBe(false);
  });
});

describe("hasPathImage", () => {
  it("is true only for non-empty strings", () => {
    expect(hasPathImage("/images/paths/x.jpg")).toBe(true);
    expect(hasPathImage("")).toBe(false);
    expect(hasPathImage(null)).toBe(false);
    expect(hasPathImage(undefined)).toBe(false);
  });
});
