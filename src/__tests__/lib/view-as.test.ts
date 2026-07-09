import { describe, it, expect } from "vitest";
import {
  canUseViewAs,
  previewableRoles,
  resolveViewAsRole,
  effectiveRole,
  VIEW_AS_COOKIE,
} from "@/lib/auth/view-as";

describe("view-as: canUseViewAs", () => {
  it("allows admins and super admins", () => {
    expect(canUseViewAs("admin")).toBe(true);
    expect(canUseViewAs("super_admin")).toBe(true);
  });

  it("denies everyone else", () => {
    expect(canUseViewAs("manager")).toBe(false);
    expect(canUseViewAs("instructor")).toBe(false);
    expect(canUseViewAs("learner")).toBe(false);
    expect(canUseViewAs(null)).toBe(false);
    expect(canUseViewAs(undefined)).toBe(false);
  });
});

describe("view-as: previewableRoles", () => {
  it("lets an admin preview the org roles below them (never super_admin or self)", () => {
    const roles = previewableRoles("admin");
    expect(roles).toEqual(["manager", "instructor", "learner"]);
    expect(roles).not.toContain("admin");
    expect(roles).not.toContain("super_admin");
  });

  it("lets a super admin preview every other role", () => {
    const roles = previewableRoles("super_admin");
    expect(roles).toEqual(["admin", "manager", "instructor", "learner"]);
    expect(roles).not.toContain("super_admin");
  });

  it("returns nothing for non-privileged roles", () => {
    expect(previewableRoles("manager")).toEqual([]);
    expect(previewableRoles("learner")).toEqual([]);
    expect(previewableRoles(null)).toEqual([]);
  });
});

describe("view-as: resolveViewAsRole", () => {
  it("resolves a valid preview target for an admin", () => {
    expect(resolveViewAsRole("admin", "learner")).toBe("learner");
    expect(resolveViewAsRole("super_admin", "admin")).toBe("admin");
  });

  it("returns null when there is no cookie", () => {
    expect(resolveViewAsRole("admin", null)).toBeNull();
    expect(resolveViewAsRole("admin", undefined)).toBeNull();
    expect(resolveViewAsRole("admin", "")).toBeNull();
  });

  it("returns null when the actor may not use view-as (forged cookie)", () => {
    expect(resolveViewAsRole("learner", "admin")).toBeNull();
    expect(resolveViewAsRole("manager", "learner")).toBeNull();
    expect(resolveViewAsRole(null, "learner")).toBeNull();
  });

  it("returns null when previewing your own role (no-op)", () => {
    expect(resolveViewAsRole("admin", "admin")).toBeNull();
    expect(resolveViewAsRole("super_admin", "super_admin")).toBeNull();
  });

  it("returns null for a role the actor may not preview", () => {
    // An admin cannot preview super_admin (platform-level access).
    expect(resolveViewAsRole("admin", "super_admin")).toBeNull();
    // Garbage values never resolve.
    expect(resolveViewAsRole("admin", "root")).toBeNull();
  });
});

describe("view-as: effectiveRole", () => {
  it("returns the previewed role when a preview is active", () => {
    expect(effectiveRole("admin", "learner")).toBe("learner");
    expect(effectiveRole("super_admin", "manager")).toBe("manager");
  });

  it("falls back to the real role when no valid preview is active", () => {
    expect(effectiveRole("admin", null)).toBe("admin");
    expect(effectiveRole("admin", "super_admin")).toBe("admin");
    expect(effectiveRole("learner", "admin")).toBe("learner");
  });
});

describe("view-as: cookie name", () => {
  it("is stable", () => {
    expect(VIEW_AS_COOKIE).toBe("lms_view_as");
  });
});
