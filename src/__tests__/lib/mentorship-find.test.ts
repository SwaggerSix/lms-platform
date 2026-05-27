import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(),
}));

import { findBestMentors } from "@/lib/mentorship/matching";
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

const mentor = (over: Partial<Record<string, unknown>> = {}) => ({
  id: "m",
  user_id: "mu",
  expertise_areas: ["leadership"],
  availability: "available",
  max_mentees: 5,
  current_mentee_count: 0,
  bio: null,
  years_experience: 10,
  timezone: null,
  preferred_meeting_frequency: "weekly",
  rating: "5",
  total_reviews: 3,
  user: { id: "mu", first_name: "Mable", last_name: "Mentor" },
  ...over,
});

// No pending request → menteeGoals is "" → the AI-refinement branch
// is skipped, so we exercise the pure capacity/sort/limit path.
function baseTables(mentors: unknown[]) {
  return {
    users: { id: "me", first_name: "Me", last_name: "Ntee", job_title: "Eng" },
    user_skills: [{ skill: { name: "leadership" } }],
    mentorship_requests: [],
    mentor_profiles: mentors,
  };
}

describe("findBestMentors", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns [] when there are no mentor profiles", async () => {
    setup(baseTables([]));
    expect(await findBestMentors("me")).toEqual([]);
  });

  it("excludes mentors that are at capacity", async () => {
    setup(
      baseTables([
        mentor({ id: "full", user_id: "fu", current_mentee_count: 5, max_mentees: 5 }),
        mentor({ id: "open", user_id: "ou", current_mentee_count: 1, max_mentees: 5 }),
      ])
    );
    const result = await findBestMentors("me");
    expect(result.map((r) => r.mentorId)).toEqual(["open"]);
  });

  it("sorts by match score descending", async () => {
    setup(
      baseTables([
        // weaker: no expertise overlap, unavailable, unrated
        mentor({
          id: "weak",
          user_id: "wu",
          expertise_areas: ["cooking"],
          availability: "none",
          years_experience: 0,
          rating: null,
        }),
        // strong: full overlap, available, senior, top-rated
        mentor({ id: "strong", user_id: "su" }),
      ])
    );
    const result = await findBestMentors("me");
    expect(result.map((r) => r.mentorId)).toEqual(["strong", "weak"]);
    expect(result[0].matchScore).toBeGreaterThan(result[1].matchScore);
  });

  it("respects the limit", async () => {
    setup(
      baseTables(
        Array.from({ length: 5 }, (_, i) => mentor({ id: `m${i}`, user_id: `u${i}` }))
      )
    );
    expect((await findBestMentors("me", 2)).length).toBe(2);
  });

  it("builds match reasons (expertise overlap, availability, experience, rating)", async () => {
    setup(baseTables([mentor()]));
    const [m] = await findBestMentors("me");
    expect(m.matchReasons).toContain("Expertise matches: leadership");
    expect(m.matchReasons).toContain("Currently available for mentoring");
    expect(m.matchReasons).toContain("10 years of experience");
    expect(m.matchReasons).toContain("Highly rated (5.0/5)");
  });
});
