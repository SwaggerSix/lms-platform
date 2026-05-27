import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(),
}));

import { calculateRiskScore } from "@/lib/analytics/predictive";
import { createServiceClient } from "@/lib/supabase/service";

const mockCreateServiceClient = vi.mocked(createServiceClient);

// Per-table Proxy builder. `tables[table]` may be a single object
// (for .single()) or an array; the builder resolves to `{ data }`.
function setup(tables: Record<string, unknown>) {
  mockCreateServiceClient.mockReturnValue({
    from(table: string) {
      const result = { data: tables[table] ?? [], error: null };
      const proxy: unknown = new Proxy(
        {},
        {
          get(_t, prop) {
            if (prop === "then") {
              return (resolve: (v: typeof result) => unknown) => resolve(result);
            }
            return () => proxy;
          },
        }
      );
      return proxy;
    },
  } as never);
}

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();
const daysAhead = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();

describe("calculateRiskScore", () => {
  beforeEach(() => vi.clearAllMocks());

  it("is low risk (0) for an engaged, complete, recently-accessed enrollment", async () => {
    setup({
      enrollments: {
        progress: 100,
        enrolled_at: daysAgo(1),
        due_date: null,
        last_accessed_at: daysAgo(0),
      },
      assessment_attempts: [],
      learning_analytics_snapshots: [],
    });
    const r = await calculateRiskScore("u1", "c1");
    expect(r.riskScore).toBe(0);
    expect(r.riskLevel).toBe("low");
  });

  it("adds 15 and a never_accessed factor when last_accessed_at is null", async () => {
    setup({
      enrollments: {
        progress: 100,
        enrolled_at: daysAgo(1),
        due_date: null,
        last_accessed_at: null,
      },
      assessment_attempts: [],
      learning_analytics_snapshots: [],
    });
    const r = await calculateRiskScore("u1", "c1");
    expect(r.factors.never_accessed).toBe("true");
    expect(r.riskScore).toBe(15);
    expect(r.riskLevel).toBe("low");
  });

  it("stacks stalled-progress + overdue + stale-access + low-scores into critical", async () => {
    setup({
      enrollments: {
        progress: 5, // <10 and enrolled >7d → +25
        enrolled_at: daysAgo(40),
        due_date: daysAgo(2), // overdue → +20
        last_accessed_at: daysAgo(20), // >14d → +20
      },
      assessment_attempts: [{ score: 30 }, { score: 40 }], // avg 35 (<50) → +20
      learning_analytics_snapshots: [],
    });
    const r = await calculateRiskScore("u1", "c1");
    expect(r.riskScore).toBe(85);
    expect(r.riskLevel).toBe("critical");
    expect(r.factors.overdue_days).toBeGreaterThanOrEqual(1);
    expect(r.factors.avg_assessment_score).toBe(35);
  });

  it("maps the medium band (25-49) for a single stalled-progress factor", async () => {
    setup({
      enrollments: {
        progress: 5,
        enrolled_at: daysAgo(40),
        due_date: null,
        last_accessed_at: daysAgo(0), // recent → no recency risk
      },
      assessment_attempts: [],
      learning_analytics_snapshots: [],
    });
    const r = await calculateRiskScore("u1", "c1");
    expect(r.riskScore).toBe(25); // only the +25 stalled-progress factor
    expect(r.riskLevel).toBe("medium");
  });

  it("flags a significant engagement decline from the snapshot trend", async () => {
    setup({
      enrollments: {
        progress: 100,
        enrolled_at: daysAgo(1),
        due_date: null,
        last_accessed_at: daysAgo(0),
      },
      assessment_attempts: [],
      // recent 3 avg = 10, older avg = 80 → recent < older*0.5
      learning_analytics_snapshots: [
        { engagement_score: "10" },
        { engagement_score: "10" },
        { engagement_score: "10" },
        { engagement_score: "80" },
        { engagement_score: "80" },
      ],
    });
    const r = await calculateRiskScore("u1", "c1");
    expect(r.factors.engagement_declining).toBe("significant");
    expect(r.riskScore).toBe(15);
  });

  it("clamps the score at 100", async () => {
    setup({
      enrollments: {
        progress: 0,
        enrolled_at: daysAgo(60),
        due_date: daysAgo(30),
        last_accessed_at: daysAgo(30),
      },
      assessment_attempts: [{ score: 0 }],
      learning_analytics_snapshots: [
        { engagement_score: "1" },
        { engagement_score: "1" },
        { engagement_score: "1" },
        { engagement_score: "90" },
        { engagement_score: "90" },
      ],
    });
    const r = await calculateRiskScore("u1", "c1");
    expect(r.riskScore).toBe(100);
    expect(r.riskLevel).toBe("critical");
  });
});
