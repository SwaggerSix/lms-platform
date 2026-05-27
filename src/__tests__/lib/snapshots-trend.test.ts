import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(),
}));

import { getTrendData } from "@/lib/analytics/snapshots";
import { createServiceClient } from "@/lib/supabase/service";

const mockCreateServiceClient = vi.mocked(createServiceClient);

// Proxy builder: any chained method returns the builder; awaiting it
// resolves to `{ data }`.
function setup(rows: unknown[]) {
  const result = { data: rows, error: null };
  const builder: Record<string, unknown> = {};
  const proxy: unknown = new Proxy(builder, {
    get(_t, prop) {
      if (prop === "then") {
        return (resolve: (v: typeof result) => unknown) => resolve(result);
      }
      return () => proxy;
    },
  });
  mockCreateServiceClient.mockReturnValue({ from: () => proxy } as never);
}

describe("getTrendData", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns [] when there are no snapshots", async () => {
    setup([]);
    expect(await getTrendData("u1")).toEqual([]);
  });

  it("maps snake_case columns to the camelCase SnapshotData shape", async () => {
    setup([
      {
        snapshot_date: "2026-05-01",
        courses_enrolled: 3,
        courses_completed: 1,
        avg_progress: "42.5",
        avg_score: "88.0",
        login_streak: 4,
        total_time_minutes: 120,
        engagement_score: "67.2",
      },
    ]);
    const [row] = await getTrendData("u1");
    expect(row).toEqual({
      snapshotDate: "2026-05-01",
      coursesEnrolled: 3,
      coursesCompleted: 1,
      avgProgress: 42.5,
      avgScore: 88,
      loginStreak: 4,
      totalTimeMinutes: 120,
      engagementScore: 67.2,
    });
  });

  it("coerces null/invalid numeric strings to 0", async () => {
    setup([
      {
        snapshot_date: "2026-05-02",
        courses_enrolled: 0,
        courses_completed: 0,
        avg_progress: null,
        avg_score: undefined,
        login_streak: 0,
        total_time_minutes: 0,
        engagement_score: "not-a-number",
      },
    ]);
    const [row] = await getTrendData("u1");
    expect(row.avgProgress).toBe(0);
    expect(row.avgScore).toBe(0);
    expect(row.engagementScore).toBe(0);
  });
});
