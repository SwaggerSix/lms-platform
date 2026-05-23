import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import AuditLogClient, { type AuditEntry } from "@/app/(dashboard)/admin/audit-log/audit-log-client";

/**
 * The audit-log page caps the row fetch at rowLimit (default 500) and
 * passes the exact count separately so the client can render a
 * truncation banner when there's more data than fits on the page.
 * These tests pin that banner's visibility and contents.
 */

function entry(overrides: Partial<AuditEntry> = {}): AuditEntry {
  return {
    id: overrides.id ?? "row-1",
    timestamp: overrides.timestamp ?? "2026-03-14 10:00:00",
    userName: overrides.userName ?? "Alice",
    userAvatar: overrides.userAvatar ?? "AL",
    action: overrides.action ?? "Created",
    entityType: overrides.entityType ?? "Course",
    entityName: overrides.entityName ?? "Course 1",
    ipAddress: overrides.ipAddress ?? "10.0.0.1",
    description: overrides.description ?? "created",
    ...overrides,
  };
}

describe("AuditLogClient truncation banner", () => {
  it("shows the banner when totalRowCount exceeds rowLimit", () => {
    render(
      <AuditLogClient
        entries={[entry()]}
        rowLimit={500}
        totalRowCount={1234}
      />
    );

    const banner = screen.getByRole("status");
    expect(banner).toBeInTheDocument();
    expect(banner.textContent).toContain("Showing 500 of 1,234");
    expect(banner.textContent).toMatch(/Narrow the date range or other filters/);
  });

  it("hides the banner when totalRowCount equals rowLimit (no truncation)", () => {
    render(
      <AuditLogClient
        entries={[entry()]}
        rowLimit={500}
        totalRowCount={500}
      />
    );
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("hides the banner when totalRowCount is below rowLimit", () => {
    render(
      <AuditLogClient
        entries={[entry()]}
        rowLimit={500}
        totalRowCount={42}
      />
    );
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("hides the banner when rowLimit / totalRowCount are not supplied (backwards compat)", () => {
    render(<AuditLogClient entries={[entry()]} />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("formats large numbers with thousands separators", () => {
    render(
      <AuditLogClient
        entries={[entry()]}
        rowLimit={500}
        totalRowCount={12345678}
      />
    );
    const banner = screen.getByRole("status");
    expect(banner.textContent).toContain("12,345,678");
  });

  it("page.tsx ROW_LIMIT is the documented 500 — bumping forces a deliberate update here", async () => {
    // Lock the page-level cap that all the fixtures above assume. The
    // page's ROW_LIMIT constant isn't exported (top-level exports
    // confuse Next routing), so we read it out of the source as a
    // string and assert the literal. Bumping the cap requires
    // touching this test in the same commit.
    const { readFile } = await import("node:fs/promises");
    const { join } = await import("node:path");
    const source = await readFile(
      join(process.cwd(), "src/app/(dashboard)/admin/audit-log/page.tsx"),
      "utf8"
    );
    expect(source).toMatch(/const\s+ROW_LIMIT\s*=\s*500;/);
  });
});
