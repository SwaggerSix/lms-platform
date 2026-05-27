import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(),
}));

import { getContentBasedRecommendations } from "@/lib/ai/recommendations";
import { createServiceClient } from "@/lib/supabase/service";

const mockCreateServiceClient = vi.mocked(createServiceClient);

// Each table is queried exactly once here, so a per-table mock fits.
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

const prefs = {
  preferred_categories: ["cat-a"],
  preferred_content_types: ["self_paced"],
  preferred_difficulty: "beginner", // → 1
  preferred_duration: "short", // ≤ 60 min
};

const course = (over: Record<string, unknown> = {}) => ({
  id: "c",
  category_id: null,
  difficulty_level: "advanced", // far from beginner → no diff points
  estimated_duration: 9999, // "long" ≠ "short"
  course_type: "other",
  tags: [],
  ...over,
});

function base(courses: unknown[], over: Record<string, unknown> = {}) {
  return {
    user_learning_preferences: prefs,
    enrollments: [],
    user_skills: [],
    courses,
    course_skills: [],
    ...over,
  };
}

describe("getContentBasedRecommendations", () => {
  beforeEach(() => vi.clearAllMocks());

  it("scores a category match (+3) and surfaces the reason", async () => {
    setup(base([course({ id: "c1", category_id: "cat-a" })]));
    const [r] = await getContentBasedRecommendations("u1");
    expect(r.courseId).toBe("c1");
    expect(r.score).toBe(3);
    expect(r.reason).toMatch(/matches your preferred topics/);
  });

  it("excludes courses the user is already enrolled in", async () => {
    setup(
      base([course({ id: "enrolled", category_id: "cat-a" })], {
        enrollments: [{ course_id: "enrolled" }],
      })
    );
    expect(await getContentBasedRecommendations("u1")).toEqual([]);
  });

  it("awards difficulty proximity: exact +2, off-by-one +1", async () => {
    setup(
      base([
        course({ id: "exact", difficulty_level: "beginner" }), // delta 0 → +2
        course({ id: "near", difficulty_level: "intermediate" }), // delta 1 → +1
      ])
    );
    const out = await getContentBasedRecommendations("u1");
    const byId = Object.fromEntries(out.map((r) => [r.courseId, r.score]));
    expect(byId.exact).toBe(2);
    expect(byId.near).toBe(1);
  });

  it("boosts courses that close skill gaps (+2 per gap skill)", async () => {
    setup(
      base([course({ id: "cg" })], {
        user_skills: [
          { skill_id: "s1", proficiency_level: 1 }, // gap (<3)
          { skill_id: "s2", proficiency_level: 4 }, // not a gap
        ],
        course_skills: [
          { course_id: "cg", skill_id: "s1" },
          { course_id: "cg", skill_id: "s2" },
        ],
      })
    );
    const [r] = await getContentBasedRecommendations("u1");
    // only s1 is a gap → +2; advanced difficulty / no other matches.
    expect(r.score).toBe(2);
    expect(r.reason).toMatch(/closes your skill gaps/);
  });

  it("omits zero-score courses and sorts the rest descending", async () => {
    setup(
      base([
        course({ id: "zero" }), // no matches, no tags → score 0, excluded
        course({ id: "low", course_type: "self_paced" }), // +1.5
        course({ id: "high", category_id: "cat-a", difficulty_level: "beginner" }), // +3 +2 = 5
      ])
    );
    const out = await getContentBasedRecommendations("u1");
    expect(out.map((r) => r.courseId)).toEqual(["high", "low"]);
  });

  it("respects the limit", async () => {
    setup(
      base(
        Array.from({ length: 5 }, (_, i) => course({ id: `c${i}`, category_id: "cat-a" }))
      )
    );
    expect((await getContentBasedRecommendations("u1", 2)).length).toBe(2);
  });
});
