import { describe, it, expect } from "vitest";
import { matrixCellStatus } from "@/lib/reports/generate";

const NOW = Date.now();
const monthsAgo = (n: number) => {
  const d = new Date(NOW);
  d.setMonth(d.getMonth() - n);
  return d.toISOString();
};

describe("matrixCellStatus", () => {
  it("marks never-enrolled users as not_enrolled", () => {
    expect(matrixCellStatus(undefined, 12, NOW).status).toBe("not_enrolled");
  });

  it("marks enrolled-but-incomplete as non_compliant", () => {
    expect(
      matrixCellStatus({ status: "in_progress", completed_at: null }, 12, NOW)
        .status
    ).toBe("non_compliant");
  });

  it("treats one-time requirements as compliant once completed", () => {
    const cell = matrixCellStatus(
      { status: "completed", completed_at: monthsAgo(48) },
      null,
      NOW
    );
    expect(cell.status).toBe("compliant");
    expect(cell.nextDue).toBeNull();
  });

  it("marks lapsed recertifications as overdue", () => {
    const cell = matrixCellStatus(
      { status: "completed", completed_at: monthsAgo(14) },
      12,
      NOW
    );
    expect(cell.status).toBe("overdue");
    expect(cell.daysUntilDue).toBeLessThan(0);
  });

  it("marks completions expiring within 90 days as expiring", () => {
    const cell = matrixCellStatus(
      { status: "completed", completed_at: monthsAgo(10) },
      12,
      NOW
    );
    expect(cell.status).toBe("expiring");
    expect(cell.daysUntilDue).toBeGreaterThanOrEqual(0);
    expect(cell.daysUntilDue).toBeLessThanOrEqual(90);
  });

  it("marks fresh completions as compliant with a future due date", () => {
    const cell = matrixCellStatus(
      { status: "completed", completed_at: monthsAgo(1) },
      12,
      NOW
    );
    expect(cell.status).toBe("compliant");
    expect(cell.daysUntilDue).toBeGreaterThan(90);
    expect(cell.nextDue).not.toBeNull();
  });
});
