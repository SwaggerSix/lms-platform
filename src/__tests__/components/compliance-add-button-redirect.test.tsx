import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ComplianceClient, {
  type ComplianceRequirement,
  type ComplianceOverviewStat,
} from "@/app/(dashboard)/admin/compliance/compliance-client";

/**
 * The /api/compliance POST endpoint returns 410, so the "Add
 * Requirement" button can't open an inline create modal anymore.
 * openCreateModal now redirects to /admin/courses where required
 * training is actually configured. This test pins that behavior so
 * a refactor doesn't accidentally re-introduce the dead modal flow.
 */

const stat: ComplianceOverviewStat = { label: "Total", value: "0" };

const baseReq: ComplianceRequirement = {
  id: "course:c1",
  name: "Safety Training",
  regulation: "OSHA",
  mandatory: true,
  applicableTo: "All Employees",
  linkedCourse: "Safety 101",
  frequency: "Annual",
  complianceRate: 80,
  totalUsers: 10,
  compliantUsers: 8,
  overdueUsers: 2,
  userStatus: [],
  origin: "course",
};

describe('ComplianceClient "Add Requirement" button', () => {
  let hrefBefore: string;
  beforeEach(() => {
    hrefBefore = window.location.href;
    // jsdom's window.location is read-only by default; replace it with
    // a stub that records assignments to .href.
    Object.defineProperty(window, "location", {
      value: { href: hrefBefore },
      writable: true,
    });
  });
  afterEach(() => {
    Object.defineProperty(window, "location", {
      value: { href: hrefBefore },
      writable: true,
    });
  });

  it("redirects to /admin/courses on click (no modal opens)", () => {
    render(
      <ComplianceClient
        requirements={[baseReq]}
        overviewStats={[stat, stat, stat, stat]}
      />
    );

    const button = screen.getByRole("button", { name: /Add Requirement/i });
    fireEvent.click(button);

    expect(window.location.href).toBe("/admin/courses");
    // The "Add Compliance Requirement" modal title would only render if
    // the dead create-mode flow somehow came back.
    expect(screen.queryByText(/Add Compliance Requirement/i)).not.toBeInTheDocument();
  });
});
