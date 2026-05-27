import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(),
}));

import { getCollaborativeRecommendations } from "@/lib/ai/recommendations";
import { createServiceClient } from "@/lib/supabase/service";

const mockCreateServiceClient = vi.mocked(createServiceClient);

// `enrollments` is queried multiple times in sequence; serve a queue
// of result-sets per table (consumed in call order).
function setup(queues: Record<string, unknown[][]>) {
  const cursors: Record<string, number> = {};
  mockCreateServiceClient.mockReturnValue({
    from(table: string) {
      const i = cursors[table] ?? 0;
      cursors[table] = i + 1;
      const data = queues[table]?.[i] ?? [];
      const result = { data, error: null };
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

describe("getCollaborativeRecommendations", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns [] when the user has completed nothing", async () => {
    setup({ enrollments: [[{ course_id: "A", status: "active" }]] });
    expect(await getCollaborativeRecommendations("u1")).toEqual([]);
  });

  it("recommends courses that similar learners completed, weighted by similarity", async () => {
    setup({
      enrollments: [
        // 1) current user's enrollments
        [{ course_id: "A", status: "completed" }],
        // 2) other users who completed A
        [
          { user_id: "u2", course_id: "A", status: "completed" },
          { user_id: "u3", course_id: "A", status: "completed" },
        ],
        // 3) all completions by the top similar users
        [
          { user_id: "u2", course_id: "A" },
          { user_id: "u2", course_id: "B" },
          { user_id: "u3", course_id: "A" },
          { user_id: "u3", course_id: "C" },
        ],
      ],
    });
    const out = await getCollaborativeRecommendations("u1");
    // A is excluded (already taken); B and C surface, each weighted by
    // the recommending user's Jaccard similarity (1.0 here).
    expect(out.map((r) => r.courseId).sort()).toEqual(["B", "C"]);
    expect(out.every((r) => r.score === 1)).toBe(true);
    expect(out[0].reason).toMatch(/similar history/);
  });

  it("returns [] when no other user shares a completed course", async () => {
    setup({
      enrollments: [
        [{ course_id: "A", status: "completed" }],
        [], // nobody else completed A
      ],
    });
    expect(await getCollaborativeRecommendations("u1")).toEqual([]);
  });
});
