import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Confidence guard for the `as unknown as RowType[]` boundary casts
 * across the files that hand loosely-typed query rows to a typed
 * consumer. Those casts assert a shape the type checker can't verify
 * against the query, so if someone drops a column from a
 * `.select(...)` the consumer would silently read `undefined` at
 * runtime.
 *
 * Each block pins that every column/relation a consumer reads is
 * still named in the query's select string — catching select drift
 * that the cast would otherwise hide.
 */

const read = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8");
const SOURCE = read("src/lib/reports/generate.ts");
const NOTIF_AUDIT = read("src/app/api/admin/notification-audit/route.ts");
const AI_RECS = read("src/lib/ai/recommendations.ts");
const ASSESSMENTS = read("src/app/(dashboard)/admin/assessments/page.tsx");
const AUDIT_LOG = read("src/app/(dashboard)/admin/audit-log/page.tsx");
const ILT = read("src/app/(dashboard)/learn/ilt-sessions/page.tsx");
const CATALOG = read("src/app/(dashboard)/learn/catalog/[slug]/page.tsx");

describe("reports/generate.ts select coverage", () => {
  it("completion report select names every consumed field", () => {
    // CompletionRow consumers: user(first_name,last_name,email,
    // organization(name)), course(title), status, score,
    // enrolled_at, completed_at, time_spent.
    for (const col of [
      "first_name",
      "last_name",
      "email",
      "organization",
      "course:courses(title)",
      "status",
      "score",
      "enrolled_at",
      "completed_at",
      "time_spent",
    ]) {
      expect(SOURCE, `completion select missing ${col}`).toContain(col);
    }
  });

  it("skills-gap report select names every consumed field", () => {
    // SkillsGapRow consumers: proficiency_level, source, assessed_at,
    // user(first_name,last_name,organization(name)),
    // skill(name,category).
    for (const col of [
      "proficiency_level",
      "source",
      "assessed_at",
      "skill:skills(name, category)",
    ]) {
      expect(SOURCE, `skills-gap select missing ${col}`).toContain(col);
    }
  });
});

describe("notification-audit row-type select coverage", () => {
  it("rule-log select names the RuleLogRow fields", () => {
    // RuleLogRow: id, rule_id, user_id, error_message, created_at.
    for (const col of ["id", "rule_id", "user_id", "error_message", "created_at"]) {
      expect(NOTIF_AUDIT, `rule-log select missing ${col}`).toContain(col);
    }
  });

  it("workflow-log select names the WorkflowLogRow fields", () => {
    // WorkflowLogRow: id, run_id, step_id, error_message, created_at.
    for (const col of ["run_id", "step_id"]) {
      expect(NOTIF_AUDIT, `workflow-log select missing ${col}`).toContain(col);
    }
  });
});

describe("lib/ai/recommendations enrollment select coverage", () => {
  it("enrollment join names the EnrollCourseRel fields the prefs reader uses", () => {
    // EnrollCourseRel: id, category_id, difficulty_level,
    // estimated_duration, course_type, tags.
    for (const col of [
      "category_id",
      "difficulty_level",
      "estimated_duration",
      "course_type",
      "tags",
    ]) {
      expect(AI_RECS, `enrollment course select missing ${col}`).toContain(col);
    }
  });
});

describe("corrected-relation select coverage (admin/learn pages)", () => {
  it("assessments names the course:courses(title) join", () => {
    expect(ASSESSMENTS).toContain("course:courses(title)");
  });

  it("audit-log names the user join fields it reads", () => {
    for (const col of ["first_name", "last_name", "email", "organization:organizations"]) {
      expect(AUDIT_LOG, `audit-log user select missing ${col}`).toContain(col);
    }
  });

  it("ilt-sessions names the course + instructor joins", () => {
    expect(ILT).toContain("course:courses(title)");
    expect(ILT).toContain("instructor:users");
  });

  it("catalog names the categories join (id, name, slug)", () => {
    expect(CATALOG).toContain("categories(id, name, slug)");
  });
});
