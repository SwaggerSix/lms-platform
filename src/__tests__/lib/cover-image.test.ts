import { describe, it, expect } from "vitest";
import { hasCoverImage } from "@/lib/courses/cover-image";

describe("hasCoverImage", () => {
  it("returns true for a non-empty stored URL", () => {
    expect(
      hasCoverImage("https://abc.supabase.co/storage/v1/object/public/course-images/x.jpg")
    ).toBe(true);
  });

  it("returns false for null/undefined", () => {
    expect(hasCoverImage(null)).toBe(false);
    expect(hasCoverImage(undefined)).toBe(false);
  });

  it("returns false for empty or whitespace-only strings", () => {
    expect(hasCoverImage("")).toBe(false);
    expect(hasCoverImage("   ")).toBe(false);
  });
});
