import { describe, it, expect } from "vitest";
import { isUuid, parseUuid } from "@/lib/validate-uuid";

describe("isUuid", () => {
  it("accepts canonical lowercase UUIDs", () => {
    expect(isUuid("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
  });
  it("accepts uppercase UUIDs", () => {
    expect(isUuid("550E8400-E29B-41D4-A716-446655440000")).toBe(true);
  });
  it("accepts mixed-case UUIDs", () => {
    expect(isUuid("550e8400-E29B-41d4-A716-446655440000")).toBe(true);
  });
  it("rejects non-string values", () => {
    expect(isUuid(null)).toBe(false);
    expect(isUuid(undefined)).toBe(false);
    expect(isUuid(12345)).toBe(false);
    expect(isUuid({})).toBe(false);
    expect(isUuid([])).toBe(false);
  });
  it("rejects strings missing dashes", () => {
    expect(isUuid("550e8400e29b41d4a716446655440000")).toBe(false);
  });
  it("rejects strings with the wrong group lengths", () => {
    expect(isUuid("550e8400-e29b-41d4-a716-44665544000")).toBe(false);
    expect(isUuid("550e8400-e29b-41d4-a716-4466554400000")).toBe(false);
  });
  it("rejects strings with non-hex characters", () => {
    expect(isUuid("zzze8400-e29b-41d4-a716-446655440000")).toBe(false);
  });
  it("rejects empty string", () => {
    expect(isUuid("")).toBe(false);
  });
});

describe("parseUuid", () => {
  it("returns the lowercased UUID on a valid input", () => {
    expect(parseUuid("550E8400-E29B-41D4-A716-446655440000")).toBe(
      "550e8400-e29b-41d4-a716-446655440000"
    );
  });
  it("returns null for null / undefined / non-string", () => {
    expect(parseUuid(null)).toBeNull();
    expect(parseUuid(undefined)).toBeNull();
    expect(parseUuid(12345)).toBeNull();
  });
  it("returns null for malformed strings", () => {
    expect(parseUuid("not-a-uuid")).toBeNull();
    expect(parseUuid("550e8400-e29b-41d4-a716-44665544000")).toBeNull();
  });
});
