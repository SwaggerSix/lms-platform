import { describe, it, expect } from "vitest";
import { isAdmin, isManagerOrAbove } from "@/lib/auth/roles";

describe("isAdmin", () => {
  it("returns true for admin + super_admin", () => {
    expect(isAdmin("admin")).toBe(true);
    expect(isAdmin("super_admin")).toBe(true);
  });

  it("returns false for manager / learner / instructor", () => {
    expect(isAdmin("manager")).toBe(false);
    expect(isAdmin("learner")).toBe(false);
    expect(isAdmin("instructor")).toBe(false);
  });

  it("returns false for non-string inputs", () => {
    expect(isAdmin(null)).toBe(false);
    expect(isAdmin(undefined)).toBe(false);
    expect(isAdmin(42)).toBe(false);
    expect(isAdmin({})).toBe(false);
  });

  it("is case-sensitive", () => {
    expect(isAdmin("Admin")).toBe(false);
    expect(isAdmin("ADMIN")).toBe(false);
  });
});

describe("isManagerOrAbove", () => {
  it("returns true for admin, super_admin, manager", () => {
    expect(isManagerOrAbove("admin")).toBe(true);
    expect(isManagerOrAbove("super_admin")).toBe(true);
    expect(isManagerOrAbove("manager")).toBe(true);
  });

  it("returns false for learner / instructor", () => {
    expect(isManagerOrAbove("learner")).toBe(false);
    expect(isManagerOrAbove("instructor")).toBe(false);
  });

  it("returns false for non-string inputs", () => {
    expect(isManagerOrAbove(null)).toBe(false);
    expect(isManagerOrAbove(undefined)).toBe(false);
  });
});
