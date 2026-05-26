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

  it("AUDIT_LOG_ROW_LIMIT exported constant is 500 — bumping forces a deliberate update here", async () => {
    // The fixtures above all assume rowLimit=500. Importing the
    // production constant directly means a bump propagates here as a
    // type-check failure (or this assertion) rather than silently
    // diverging between the test and the page.
    const { AUDIT_LOG_ROW_LIMIT } = await import("@/lib/audit-log/resolve-tenant");
    expect(AUDIT_LOG_ROW_LIMIT).toBe(500);
  });

  it("AUDIT_LOG_ROW_LIMIT bump shows up as a named diff line in PRs (inline snapshot)", async () => {
    // Snapshot the literal value rather than just asserting `=== 500`.
    // A bump produces a one-line snapshot diff with the helpful
    // identifier name attached (`AUDIT_LOG_ROW_LIMIT: 500` → `:
    // 1000`), which reads more clearly during PR review than the
    // bare assertion above.
    const { AUDIT_LOG_ROW_LIMIT } = await import("@/lib/audit-log/resolve-tenant");
    expect({ AUDIT_LOG_ROW_LIMIT }).toMatchInlineSnapshot(`
      {
        "AUDIT_LOG_ROW_LIMIT": 500,
      }
    `);
  });

  it("audit-log page.tsx threads AUDIT_LOG_ROW_LIMIT through .limit() and rowLimit prop", async () => {
    // Catches a drift where someone hardcodes `500` back into the
    // page (or any other literal). Page source must reference the
    // shared constant — not just import it.
    const { readFile } = await import("node:fs/promises");
    const { join } = await import("node:path");
    const source = await readFile(
      join(process.cwd(), "src/app/(dashboard)/admin/audit-log/page.tsx"),
      "utf8"
    );
    expect(source).toContain("AUDIT_LOG_ROW_LIMIT");
    expect(source).toMatch(/\.limit\(AUDIT_LOG_ROW_LIMIT\)/);
    expect(source).toMatch(/rowLimit=\{AUDIT_LOG_ROW_LIMIT\}/);
    // No bare `500` literal in the page (matches it as a standalone
    // number; comments / strings won't trip).
    expect(source).not.toMatch(/[^0-9]500[^0-9]/);
  });
});
