import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(),
}));

import { computeEngagementScore } from "@/lib/analytics/predictive";
import { createServiceClient } from "@/lib/supabase/service";

const mockCreateServiceClient = vi.mocked(createServiceClient);

type TableData = Record<string, unknown[]>;

// A chainable query builder whose every method returns `this` and
// which resolves (await/Promise.all) to `{ data }` for its table.
function makeService(tables: TableData) {
  return {
    from(table: string) {
      const result = { data: tables[table] ?? [], error: null };
      const builder: Record<string, unknown> = {};
      for (const m of ["select", "eq", "order", "limit"]) {
        builder[m] = () => builder;
      }
      builder.then = (resolve: (v: typeof result) => unknown) => resolve(result);
      return builder;
    },
  };
}

function setup(tables: TableData) {
  mockCreateServiceClient.mockReturnValue(makeService(tables) as never);
}

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

describe("computeEngagementScore", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 0 when the user has no activity at all", async () => {
    setup({ enrollments: [], lesson_progress: [], assessment_attempts: [] });
    expect(await computeEngagementScore("u1")).toBe(0);
  });

  it("caps the active-enrollments factor at 20 (5 each)", async () => {
    // 10 active enrollments * 5 = 50, capped to 20. No other signals
    // (no progress, no recent access).
    const enrollments = Array.from({ length: 10 }, () => ({
      progress: 0,
      last_accessed_at: null,
    }));
    setup({ enrollments, lesson_progress: [], assessment_attempts: [] });
    expect(await computeEngagementScore("u1")).toBe(20);
  });

  it("awards full progress momentum (25) for 100%-progress enrollments", async () => {
    // 1 enrollment (5) + avg progress 100 → 25 = 30. last_accessed null.
    setup({
      enrollments: [{ progress: 100, last_accessed_at: null }],
      lesson_progress: [],
      assessment_attempts: [],
    });
    expect(await computeEngagementScore("u1")).toBe(30);
  });

  it("gives the top recency tier (10) for access within a day", async () => {
    // 1 enrollment (5) + recency <1 day (10) = 15.
    setup({
      enrollments: [{ progress: 0, last_accessed_at: daysAgo(0) }],
      lesson_progress: [],
      assessment_attempts: [],
    });
    expect(await computeEngagementScore("u1")).toBe(15);
  });

  it("counts only lessons completed within the last 7 days for recent-activity", async () => {
    setup({
      enrollments: [],
      lesson_progress: [
        { completed_at: daysAgo(1) },
        { completed_at: daysAgo(3) },
        { completed_at: daysAgo(30) }, // too old — excluded
      ],
      assessment_attempts: [],
    });
    // 2 recent * 5 = 10.
    expect(await computeEngagementScore("u1")).toBe(10);
  });

  it("clamps the total at 100", async () => {
    const enrollments = Array.from({ length: 10 }, () => ({
      progress: 100,
      last_accessed_at: daysAgo(0),
    }));
    const lesson_progress = Array.from({ length: 10 }, () => ({
      completed_at: daysAgo(1),
    }));
    const assessment_attempts = Array.from({ length: 10 }, () => ({
      completed_at: daysAgo(1),
    }));
    setup({ enrollments, lesson_progress, assessment_attempts });
    expect(await computeEngagementScore("u1")).toBe(100);
  });
});
