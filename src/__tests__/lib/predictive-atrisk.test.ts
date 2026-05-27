import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(),
}));

import { identifyAtRiskLearners } from "@/lib/analytics/predictive";
import { createServiceClient } from "@/lib/supabase/service";

const mockCreateServiceClient = vi.mocked(createServiceClient);

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

describe("identifyAtRiskLearners", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns [] when there are no high/critical predictions", async () => {
    setup({ risk_predictions: [] });
    expect(await identifyAtRiskLearners()).toEqual([]);
  });

  it("maps a prediction row to the AtRiskLearner shape", async () => {
    setup({
      risk_predictions: [
        {
          user_id: "u1",
          course_id: "c1",
          risk_level: "critical",
          risk_score: "82.5",
          factors: { never_accessed: "true" },
          recommended_actions: ["Send a welcome email"],
          computed_at: "2026-05-01T00:00:00Z",
          user: { id: "u1", first_name: "Ada", last_name: "Lovelace", email: "ada@x.com" },
          course: { id: "c1", title: "Intro" },
        },
      ],
    });
    const [r] = await identifyAtRiskLearners();
    expect(r).toEqual({
      userId: "u1",
      userName: "Ada Lovelace",
      email: "ada@x.com",
      courseId: "c1",
      courseTitle: "Intro",
      riskLevel: "critical",
      riskScore: 82.5,
      factors: { never_accessed: "true" },
      recommendedActions: ["Send a welcome email"],
      computedAt: "2026-05-01T00:00:00Z",
    });
  });

  it("falls back to safe defaults when the user/course joins or fields are missing", async () => {
    setup({
      risk_predictions: [
        {
          user_id: "u2",
          course_id: "c2",
          risk_level: "high",
          risk_score: "55",
          factors: null,
          recommended_actions: null,
          computed_at: null,
          user: null,
          course: null,
        },
      ],
    });
    const [r] = await identifyAtRiskLearners();
    expect(r.userName).toBe("Unknown");
    expect(r.email).toBe("");
    expect(r.courseTitle).toBe("Unknown Course");
    expect(r.factors).toEqual({});
    expect(r.recommendedActions).toEqual([]);
  });
});
