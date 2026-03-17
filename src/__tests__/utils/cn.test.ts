import { describe, it, expect } from "vitest";
import { cn } from "@/utils/cn";

describe("cn utility", () => {
  it("merges class names", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("handles conditional classes", () => {
    expect(cn("base", false && "hidden", "visible")).toBe("base visible");
  });

  it("handles undefined and null", () => {
    expect(cn("base", undefined, null, "end")).toBe("base end");
  });

  it("resolves Tailwind conflicts (last wins)", () => {
    const result = cn("px-4", "px-6");
    expect(result).toBe("px-6");
  });

  it("resolves conflicting Tailwind classes", () => {
    const result = cn("text-red-500", "text-blue-500");
    expect(result).toBe("text-blue-500");
  });

  it("handles empty arguments", () => {
    expect(cn()).toBe("");
  });

  it("handles arrays via clsx", () => {
    expect(cn(["foo", "bar"])).toBe("foo bar");
  });
});
