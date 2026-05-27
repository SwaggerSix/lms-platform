import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(),
}));

import { createDailySnapshot } from "@/lib/analytics/snapshots";
import { createServiceClient } from "@/lib/supabase/service";

const mockCreateServiceClient = vi.mocked(createServiceClient);

// Mock that resolves reads from `tables` and captures upsert payloads.
function setup(tables: Record<string, unknown>) {
  const upserts: unknown[] = [];
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
            if (prop === "upsert") {
              return (payload: unknown) => {
                upserts.push(payload);
                return proxy;
              };
            }
            return () => proxy;
          },
        }
      );
      return proxy;
    },
  } as never);
  return upserts;
}

const yesterday = () => new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
const today = () => new Date().toISOString().slice(0, 10);

describe("createDailySnapshot", () => {
  beforeEach(() => vi.clearAllMocks());

  it("upserts a snapshot keyed on user+date with computed aggregates", async () => {
    const upserts = setup({
      enrollments: [
        { status: "completed", progress: 100 },
        { status: "active", progress: 50 },
      ],
      assessment_attempts: [{ score: 80 }, { score: 90 }],
      learning_analytics_snapshots: [],
      lesson_progress: [{ time_spent_seconds: 600 }, { time_spent_seconds: 300 }],
    });

    await createDailySnapshot("u1");

    expect(upserts).toHaveLength(1);
    const payload = upserts[0] as Record<string, unknown>;
    expect(payload.user_id).toBe("u1");
    expect(payload.snapshot_date).toBe(today());
    expect(payload.courses_enrolled).toBe(2);
    expect(payload.courses_completed).toBe(1);
    expect(payload.avg_progress).toBe(75); // (100 + 50) / 2
    expect(payload.avg_score).toBe(85); // (80 + 90) / 2
    expect(payload.total_time_minutes).toBe(15); // (600 + 300) / 60
  });

  it("continues the login streak when the previous snapshot was yesterday", async () => {
    const upserts = setup({
      enrollments: [],
      assessment_attempts: [],
      learning_analytics_snapshots: [{ snapshot_date: yesterday(), login_streak: 4 }],
      lesson_progress: [],
    });
    await createDailySnapshot("u1");
    expect((upserts[0] as Record<string, unknown>).login_streak).toBe(5);
  });

  it("resets the streak to 1 when the previous snapshot is not yesterday", async () => {
    const upserts = setup({
      enrollments: [],
      assessment_attempts: [],
      learning_analytics_snapshots: [{ snapshot_date: "2020-01-01", login_streak: 9 }],
      lesson_progress: [],
    });
    await createDailySnapshot("u1");
    expect((upserts[0] as Record<string, unknown>).login_streak).toBe(1);
  });

  it("starts a streak of 1 for a brand-new user with no prior snapshots", async () => {
    const upserts = setup({
      enrollments: [],
      assessment_attempts: [],
      learning_analytics_snapshots: [],
      lesson_progress: [],
    });
    await createDailySnapshot("u1");
    expect((upserts[0] as Record<string, unknown>).login_streak).toBe(1);
  });
});
