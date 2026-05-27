import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(),
}));

import { computeUserPreferences } from "@/lib/ai/recommendations";
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

const enrollment = (over: Record<string, unknown> = {}) => ({
  status: "completed",
  score: null,
  time_spent: 0,
  course: {
    id: "c",
    category_id: "cat-a",
    difficulty_level: "beginner",
    estimated_duration: 60,
    course_type: "self_paced",
    tags: [],
  },
  ...over,
});

describe("computeUserPreferences", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns safe defaults for a user with no enrollments", async () => {
    setup({ enrollments: [], learning_events: [] });
    const p = await computeUserPreferences("u1");
    expect(p.preferred_difficulty).toBeNull();
    expect(p.preferred_categories).toEqual([]);
    expect(p.learning_pace).toBe("moderate");
    expect(p.completion_rate).toBe(0);
    expect(p.avg_score).toBeNull();
  });

  it("picks the most common difficulty and category", async () => {
    setup({
      enrollments: [
        enrollment({ course: { ...enrollment().course, difficulty_level: "advanced", category_id: "cat-x" } }),
        enrollment({ course: { ...enrollment().course, difficulty_level: "advanced", category_id: "cat-x" } }),
        enrollment({ course: { ...enrollment().course, difficulty_level: "beginner", category_id: "cat-y" } }),
      ],
      learning_events: [],
    });
    const p = await computeUserPreferences("u1");
    expect(p.preferred_difficulty).toBe("advanced");
    expect(p.preferred_categories[0]).toBe("cat-x");
  });

  it("classifies a high completion rate as a fast learning pace", async () => {
    setup({
      enrollments: [enrollment(), enrollment(), enrollment()], // 3/3 completed = 100%
      learning_events: [],
    });
    const p = await computeUserPreferences("u1");
    expect(p.completion_rate).toBe(100);
    expect(p.learning_pace).toBe("fast");
  });

  it("classifies a low completion rate (with >2 enrollments) as slow", async () => {
    setup({
      enrollments: [
        enrollment({ status: "active" }),
        enrollment({ status: "active" }),
        enrollment({ status: "active" }),
        enrollment({ status: "completed" }),
      ], // 1/4 = 25% < 30
      learning_events: [],
    });
    const p = await computeUserPreferences("u1");
    expect(p.learning_pace).toBe("slow");
  });

  it("averages assessment scores and rounds to two decimals", async () => {
    setup({
      enrollments: [enrollment({ score: 80 }), enrollment({ score: 91 })],
      learning_events: [],
    });
    const p = await computeUserPreferences("u1");
    expect(p.avg_score).toBe(85.5);
  });

  it("derives a valid best-learning-time bucket from events", async () => {
    setup({
      enrollments: [],
      learning_events: [
        { event_type: "x", created_at: new Date().toISOString() },
      ],
    });
    const p = await computeUserPreferences("u1");
    expect(["morning", "afternoon", "evening"]).toContain(p.best_learning_time);
  });
});
