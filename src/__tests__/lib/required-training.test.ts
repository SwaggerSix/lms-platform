import { describe, it, expect, vi } from "vitest";
import {
  readRequiredFor,
  recertificationTier,
  userMatchesRequiredFor,
  getRequiredCourseSources,
  getTenantScopedRequiredCourseSources,
} from "@/lib/courses/required-training";

describe("readRequiredFor", () => {
  it("returns null when metadata is missing or empty", () => {
    expect(readRequiredFor(null)).toBeNull();
    expect(readRequiredFor(undefined)).toBeNull();
    expect(readRequiredFor({})).toBeNull();
    expect(readRequiredFor({ required_for: null })).toBeNull();
  });

  it("returns null when neither roles nor organization_ids are set", () => {
    expect(readRequiredFor({ required_for: { roles: [], organization_ids: [] } })).toBeNull();
  });

  it("parses roles and lowercases them, dropping unknowns", () => {
    const result = readRequiredFor({
      required_for: { roles: ["Learner", "ADMIN", "not_a_role", "  Manager "] },
    });
    expect(result).not.toBeNull();
    expect(result!.roles.sort()).toEqual(["admin", "learner", "manager"]);
    expect(result!.organization_ids).toEqual([]);
  });

  it("parses organization_ids, trimming and dropping empties", () => {
    const result = readRequiredFor({
      required_for: { organization_ids: [" org-1 ", "", "org-2"] },
    });
    expect(result).not.toBeNull();
    expect(result!.organization_ids).toEqual(["org-1", "org-2"]);
  });

  it("parses positive due_days; ignores zero / negative / non-numeric", () => {
    expect(readRequiredFor({ required_for: { roles: ["learner"], due_days: 30 } })!.due_days).toBe(30);
    expect(readRequiredFor({ required_for: { roles: ["learner"], due_days: 0 } })!.due_days).toBeUndefined();
    expect(readRequiredFor({ required_for: { roles: ["learner"], due_days: -5 } })!.due_days).toBeUndefined();
    expect(readRequiredFor({ required_for: { roles: ["learner"], due_days: "garbage" } })!.due_days).toBeUndefined();
  });

  it("parses compliance fields: regulation, frequency_months, is_mandatory", () => {
    const result = readRequiredFor({
      required_for: {
        roles: ["learner"],
        regulation: " HIPAA  ",
        frequency_months: 12,
        is_mandatory: false,
      },
    });
    expect(result!.regulation).toBe("HIPAA");
    expect(result!.frequency_months).toBe(12);
    expect(result!.is_mandatory).toBe(false);
  });

  it("defaults is_mandatory to true when omitted", () => {
    const result = readRequiredFor({ required_for: { roles: ["learner"] } });
    expect(result!.is_mandatory).toBe(true);
  });

  it("ignores empty/whitespace regulation and non-positive frequency", () => {
    const result = readRequiredFor({
      required_for: { roles: ["learner"], regulation: "   ", frequency_months: 0 },
    });
    expect(result!.regulation).toBeUndefined();
    expect(result!.frequency_months).toBeUndefined();
  });
});

describe("recertificationTier", () => {
  // Anchor "now" to a fixed moment so the assertions are deterministic.
  const now = new Date("2026-06-15T12:00:00.000Z");

  it("returns null when frequencyMonths is 0 or negative", () => {
    expect(recertificationTier("2025-01-01T00:00:00Z", 0, now)).toBeNull();
    expect(recertificationTier("2025-01-01T00:00:00Z", -3, now)).toBeNull();
  });

  it("returns null when the completion is recent and not yet within the 30-day window", () => {
    // completed 1 month ago + 12-month recurrence → ~11 months left.
    const completed = new Date("2026-05-15T12:00:00.000Z");
    expect(recertificationTier(completed, 12, now)).toBeNull();
  });

  it("returns '30' when within 30 days of expiry", () => {
    // Completed 2025-07-05 → expires 2026-07-05 → 20 days after now (2026-06-15).
    const completed = new Date("2025-07-05T12:00:00.000Z");
    expect(recertificationTier(completed, 12, now)).toBe("30");
  });

  it("returns '7' when within 7 days of expiry", () => {
    // Completed 2025-06-20 → expires 2026-06-20 → 5 days after now.
    const completed = new Date("2025-06-20T12:00:00.000Z");
    expect(recertificationTier(completed, 12, now)).toBe("7");
  });

  it("returns 'expired' when expiry has passed", () => {
    const completed = new Date("2025-01-01T12:00:00.000Z");
    expect(recertificationTier(completed, 12, now)).toBe("expired");
  });

  it("treats expiry on the same day as 'expired' (boundary safety)", () => {
    // Completed exactly 12 months ago → expires today → daysLeft <= 0 → expired.
    const completed = new Date("2025-06-15T12:00:00.000Z");
    expect(recertificationTier(completed, 12, now)).toBe("expired");
  });

  it("handles ISO string input identically to Date input", () => {
    const completed = "2025-07-05T12:00:00.000Z";
    expect(recertificationTier(completed, 12, now)).toBe("30");
  });

  it("returns null for unparseable date input", () => {
    expect(recertificationTier("not a date", 12, now)).toBeNull();
  });

  describe("edge-of-month arithmetic (date-fns calendar-aware)", () => {
    // recertificationTier delegates to date-fns addMonths, which clamps the
    // day to the last day of the target month rather than rolling over.
    // Jan 31 + 1 month → Feb 28 (or Feb 29 in a leap year), not March 3.

    it("Jan 31 + 1 month clamps to Feb 28 (non-leap)", () => {
      const completed = new Date("2025-01-31T12:00:00.000Z");
      // Expiry = 2025-02-28. Now = 2025-02-15 → 13 days out → tier "30".
      const nowFixed = new Date("2025-02-15T12:00:00.000Z");
      expect(recertificationTier(completed, 1, nowFixed)).toBe("30");
    });

    it("Jan 31 + 1 month within 7 days of clamped expiry → tier '7'", () => {
      const completed = new Date("2025-01-31T12:00:00.000Z");
      // Expiry = 2025-02-28. Now = 2025-02-25 → 3 days out → tier "7".
      const nowFixed = new Date("2025-02-25T12:00:00.000Z");
      expect(recertificationTier(completed, 1, nowFixed)).toBe("7");
    });

    it("Jan 30 + 12 months lands on the same calendar day next year", () => {
      const completed = new Date("2024-01-30T12:00:00.000Z");
      const nowFixed = new Date("2025-01-15T12:00:00.000Z"); // 15 days before
      expect(recertificationTier(completed, 12, nowFixed)).toBe("30");
    });

    it("Feb 29 (leap) + 12 months clamps to Feb 28 next year", () => {
      // 2024 is a leap year, 2025 is not. date-fns addMonths clamps
      // 2024-02-29 + 12 months to 2025-02-28.
      const completed = new Date("2024-02-29T12:00:00.000Z");
      const nowFar = new Date("2025-02-10T12:00:00.000Z"); // 18 days out
      expect(recertificationTier(completed, 12, nowFar)).toBe("30");
      const nowNear = new Date("2025-02-25T12:00:00.000Z"); // 3 days out
      expect(recertificationTier(completed, 12, nowNear)).toBe("7");
      const nowAfter = new Date("2025-03-01T12:00:00.000Z");
      expect(recertificationTier(completed, 12, nowAfter)).toBe("expired");
    });

    it("36-month frequency: completed 35.5 months ago → tier 30", () => {
      const completed = new Date("2023-06-30T12:00:00.000Z");
      const nowFixed = new Date("2026-06-15T12:00:00.000Z"); // 15 days before 2026-06-30
      expect(recertificationTier(completed, 36, nowFixed)).toBe("30");
    });

    it("frequency expressed as non-integer is floored before addMonths", () => {
      const completed = new Date("2025-01-15T12:00:00.000Z");
      // Math.floor(12.7) → 12 months, expiry = 2026-01-15. Now 2026-01-10
      // → 5 days out → tier "7".
      const nowFixed = new Date("2026-01-10T12:00:00.000Z");
      expect(recertificationTier(completed, 12.7, nowFixed)).toBe("7");
    });
  });
});

describe("userMatchesRequiredFor", () => {
  const base = {
    roles: [] as string[],
    organization_ids: [] as string[],
    is_mandatory: true,
  };

  it("empty roles + empty orgs is a wildcard (matches anyone)", () => {
    expect(userMatchesRequiredFor(base, { role: "learner", organization_id: "org-1" })).toBe(true);
    expect(userMatchesRequiredFor(base, { role: null, organization_id: null })).toBe(true);
  });

  it("role list requires the user's role to be in it", () => {
    const req = { ...base, roles: ["learner"] };
    expect(userMatchesRequiredFor(req, { role: "learner", organization_id: null })).toBe(true);
    expect(userMatchesRequiredFor(req, { role: "manager", organization_id: null })).toBe(false);
    expect(userMatchesRequiredFor(req, { role: null, organization_id: null })).toBe(false);
  });

  it("organization_id list requires the user's org to be in it", () => {
    const req = { ...base, organization_ids: ["org-1"] };
    expect(userMatchesRequiredFor(req, { role: "learner", organization_id: "org-1" })).toBe(true);
    expect(userMatchesRequiredFor(req, { role: "learner", organization_id: "org-2" })).toBe(false);
    expect(userMatchesRequiredFor(req, { role: "learner", organization_id: null })).toBe(false);
  });

  it("both roles and orgs set → AND semantics (both must match)", () => {
    const req = { ...base, roles: ["learner"], organization_ids: ["org-1"] };
    expect(userMatchesRequiredFor(req, { role: "learner", organization_id: "org-1" })).toBe(true);
    expect(userMatchesRequiredFor(req, { role: "learner", organization_id: "org-2" })).toBe(false);
    expect(userMatchesRequiredFor(req, { role: "manager", organization_id: "org-1" })).toBe(false);
  });
});

describe("getRequiredCourseSources", () => {
  // Build a minimal service-client stub that returns whatever course rows
  // we feed in. The helper only uses .from().select().neq() then awaits
  // the chain, so a single thenable resolves the query.
  function makeService(rows: unknown[]) {
    const chain = {
      select: () => chain,
      neq: () => Promise.resolve({ data: rows, error: null }),
    };
    return { from: () => chain } as unknown as Parameters<typeof getRequiredCourseSources>[0];
  }

  it("returns empty array when no courses carry required_for", () => {
    return expect(
      getRequiredCourseSources(
        makeService([
          { id: "c1", title: "Plain Course", metadata: {} },
          { id: "c2", title: null, metadata: { other: "data" } },
        ])
      )
    ).resolves.toEqual([]);
  });

  it("normalizes a single course with required_for into a RequiredCourseSource", async () => {
    const out = await getRequiredCourseSources(
      makeService([
        {
          id: "c1",
          title: "Safety Training",
          metadata: {
            required_for: {
              roles: ["learner"],
              organization_ids: ["org-1"],
              regulation: "OSHA",
              frequency_months: 12,
              is_mandatory: true,
            },
          },
        },
      ])
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      id: "course:c1",
      name: "Safety Training",
      regulation: "OSHA",
      mandatory: true,
      frequencyMonths: 12,
      applicableRoles: ["learner"],
      applicableOrgIds: ["org-1"],
      courseId: "c1",
      courseName: "Safety Training",
    });
    expect(out[0].createdAt).toBeInstanceOf(Date);
  });

  it("defaults missing fields to safe values", async () => {
    const out = await getRequiredCourseSources(
      makeService([
        {
          id: "c1",
          title: null,
          metadata: { required_for: { roles: ["learner"] } },
        },
      ])
    );
    expect(out[0]).toMatchObject({
      name: "Untitled Course",
      regulation: "",
      frequencyMonths: null,
      applicableOrgIds: [],
      mandatory: true,
    });
  });

  it("skips archived-shape courses (none returned because .neq filters at the query layer)", async () => {
    // Sanity: helper doesn't introspect the status field directly — the
    // .neq("status", "archived") filter is applied by the query builder.
    // This test just confirms an empty input array yields an empty output.
    await expect(getRequiredCourseSources(makeService([]))).resolves.toEqual([]);
  });

  it("returns empty array when the query errors", async () => {
    const erroringService = {
      from: () => ({
        select: () => ({
          neq: () => Promise.resolve({ data: null, error: new Error("db down") }),
        }),
      }),
    } as unknown as Parameters<typeof getRequiredCourseSources>[0];
    await expect(getRequiredCourseSources(erroringService)).resolves.toEqual([]);
  });

  it("tenant-scoped wrapper: null scope returns every source (admin)", async () => {
    const service = makeService([
      { id: "c1", title: "T1", metadata: { required_for: { roles: ["learner"] } } },
      { id: "c2", title: "T2", metadata: { required_for: { roles: ["learner"] } } },
    ]);
    const out = await getTenantScopedRequiredCourseSources(service, null);
    expect(out.map((s) => s.courseId).sort()).toEqual(["c1", "c2"]);
  });

  it("tenant-scoped wrapper: filters to scope.courseIds", async () => {
    const service = makeService([
      { id: "c1", title: "T1", metadata: { required_for: { roles: ["learner"] } } },
      { id: "c2", title: "T2", metadata: { required_for: { roles: ["learner"] } } },
      { id: "c3", title: "T3", metadata: { required_for: { roles: ["learner"] } } },
    ]);
    const out = await getTenantScopedRequiredCourseSources(service, { courseIds: ["c1", "c3"] });
    expect(out.map((s) => s.courseId).sort()).toEqual(["c1", "c3"]);
  });

  it("tenant-scoped wrapper: empty scope returns empty array", async () => {
    const service = makeService([
      { id: "c1", title: "T1", metadata: { required_for: { roles: ["learner"] } } },
    ]);
    const out = await getTenantScopedRequiredCourseSources(service, { courseIds: [] });
    expect(out).toEqual([]);
  });

  it("mandatory defaults to true unless explicitly false", async () => {
    const out = await getRequiredCourseSources(
      makeService([
        {
          id: "c1",
          title: "T1",
          metadata: { required_for: { roles: ["learner"], is_mandatory: false } },
        },
        {
          id: "c2",
          title: "T2",
          metadata: { required_for: { roles: ["learner"] } },
        },
      ])
    );
    expect(out.map((s) => [s.courseId, s.mandatory])).toEqual([
      ["c1", false],
      ["c2", true],
    ]);
  });
});

describe("end-to-end: tenant scope + role/org match", () => {
  function makeService(rows: unknown[]) {
    const chain = {
      select: () => chain,
      neq: () => Promise.resolve({ data: rows, error: null }),
    };
    return { from: () => chain } as unknown as Parameters<typeof getRequiredCourseSources>[0];
  }

  it("scope filter then role match yields exactly the matching course", async () => {
    const rows = [
      { id: "c1", title: "OSHA 101", metadata: { required_for: { roles: ["learner"], organization_ids: ["org-A"] } } },
      // c2 is in scope but applies to managers, not learners.
      { id: "c2", title: "Manager Training", metadata: { required_for: { roles: ["manager"], organization_ids: ["org-A"] } } },
      // c3 matches role but is outside the tenant scope.
      { id: "c3", title: "HR All-Hands", metadata: { required_for: { roles: ["learner"], organization_ids: ["org-B"] } } },
      // c4 has no required_for — should never appear.
      { id: "c4", title: "Optional Course", metadata: {} },
    ];
    const scoped = await getTenantScopedRequiredCourseSources(makeService(rows), {
      courseIds: ["c1", "c2"],
    });
    expect(scoped.map((s) => s.courseId).sort()).toEqual(["c1", "c2"]);

    const learner = { role: "learner", organization_id: "org-A" };
    const matching = scoped.filter((s) =>
      userMatchesRequiredFor(
        { roles: s.applicableRoles, organization_ids: s.applicableOrgIds, is_mandatory: true },
        learner
      )
    );
    expect(matching.map((s) => s.courseId)).toEqual(["c1"]);
  });

  it("empty role list on a course is a wildcard — matches any learner in scope", async () => {
    const rows = [
      { id: "c1", title: "All Hands", metadata: { required_for: { roles: [], organization_ids: ["org-A"] } } },
      { id: "c2", title: "Mgr Only", metadata: { required_for: { roles: ["manager"], organization_ids: ["org-A"] } } },
    ];
    const sources = await getTenantScopedRequiredCourseSources(makeService(rows), {
      courseIds: ["c1", "c2"],
    });
    const learner = { role: "learner", organization_id: "org-A" };
    const matching = sources.filter((s) =>
      userMatchesRequiredFor(
        { roles: s.applicableRoles, organization_ids: s.applicableOrgIds, is_mandatory: true },
        learner
      )
    );
    expect(matching.map((s) => s.courseId)).toEqual(["c1"]);
  });
});
