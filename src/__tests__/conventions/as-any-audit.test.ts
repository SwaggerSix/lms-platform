import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { walkFiles } from "@/lib/testing/walk";
import { isAsAnyLine } from "@/lib/testing/scan-casts";

/**
 * Advisory ratchet over `as any` casts — the type-safety escape
 * hatch. Each one opts a value out of the type checker, so the set
 * should only shrink. This is advisory (a shrinking ceiling +
 * file-level snapshot), not a hard assertion: many casts paper over
 * the untyped Supabase client (no generated `Database` type) and
 * can't be removed without that larger effort.
 *
 * Prefer `as unknown as T` (names the asserted shape) or, better,
 * real types. Each PR that removes a cast lowers MAX. When the
 * remaining set is all genuinely-unavoidable, freeze it.
 *
 * `as unknown as` double-casts are deliberately NOT counted — they
 * name a target type, which is the migration target here.
 */

describe("as-any cast audit (advisory)", () => {
  it("snapshot of `as any` casts under src/", () => {
    const files = walkFiles(join(process.cwd(), "src"), {
      extensions: [".ts", ".tsx"],
    });
    const sites: Array<{ file: string; line: number }> = [];
    for (const file of files) {
      const rel = file.replace(process.cwd() + "/", "");
      if (rel.startsWith("src/__tests__/")) continue;
      // The detector module defines the pattern, so its own source
      // self-matches — exclude it (mirrors role-check-patterns).
      if (rel === "src/lib/testing/scan-casts.ts") continue;
      const lines = readFileSync(file, "utf8").split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (isAsAnyLine(lines[i])) sites.push({ file: rel, line: i + 1 });
      }
    }

    const MAX = 147;
    expect(
      sites.length,
      `\`as any\` casts: ${sites.length}. Ceiling ${MAX}. Replace with real types or \`as unknown as T\` and lower MAX.`
    ).toBeLessThanOrEqual(MAX);

    const counts = new Map<string, number>();
    for (const s of sites) counts.set(s.file, (counts.get(s.file) ?? 0) + 1);
    const collapsed = Array.from(counts.entries())
      .map(([file, n]) => (n === 1 ? file : `${file} ×${n}`))
      .sort();
    expect(collapsed).toMatchInlineSnapshot(`
      [
        "src/app/(dashboard)/admin/analytics/predictive/page.tsx ×2",
        "src/app/(dashboard)/admin/analytics/predictive/predictive-client.tsx ×3",
        "src/app/(dashboard)/admin/approvals/page.tsx ×3",
        "src/app/(dashboard)/admin/assessments/page.tsx ×4",
        "src/app/(dashboard)/admin/audit-log/page.tsx ×3",
        "src/app/(dashboard)/admin/certifications/page.tsx ×3",
        "src/app/(dashboard)/admin/compliance/page.tsx",
        "src/app/(dashboard)/admin/documents/page.tsx ×2",
        "src/app/(dashboard)/admin/feedback/[id]/cycle-detail-client.tsx",
        "src/app/(dashboard)/admin/gamification/page.tsx ×2",
        "src/app/(dashboard)/admin/ilt-sessions/page.tsx",
        "src/app/(dashboard)/admin/knowledge-base/page.tsx ×3",
        "src/app/(dashboard)/admin/marketplace/page.tsx",
        "src/app/(dashboard)/admin/mentorship/admin-mentorship-client.tsx ×2",
        "src/app/(dashboard)/admin/organizations/page.tsx ×2",
        "src/app/(dashboard)/admin/reports/page.tsx",
        "src/app/(dashboard)/admin/settings/page.tsx ×2",
        "src/app/(dashboard)/admin/tenants/[id]/tenant-detail-client.tsx ×4",
        "src/app/(dashboard)/learn/assessments/[id]/page.tsx ×2",
        "src/app/(dashboard)/learn/assessments/[id]/results/page.tsx ×3",
        "src/app/(dashboard)/learn/catalog/[slug]/page.tsx ×6",
        "src/app/(dashboard)/learn/discussions/page.tsx",
        "src/app/(dashboard)/learn/feedback/[nominationId]/page.tsx ×4",
        "src/app/(dashboard)/learn/ilt-sessions/page.tsx ×4",
        "src/app/(dashboard)/learn/knowledge-base/[slug]/page.tsx",
        "src/app/(dashboard)/learn/mentorship/[requestId]/detail-client.tsx ×3",
        "src/app/(dashboard)/learn/mentorship/mentorship-client.tsx ×3",
        "src/app/(dashboard)/learn/observations/[id]/observation-detail-client.tsx",
        "src/app/(dashboard)/learn/paths/[slug]/page.tsx ×2",
        "src/app/(dashboard)/learn/paths/page.tsx ×2",
        "src/app/(dashboard)/learn/player/[courseId]/page.tsx ×2",
        "src/app/(dashboard)/learn/recommendations/page.tsx ×9",
        "src/app/(dashboard)/learn/transcript/page.tsx ×2",
        "src/app/(dashboard)/manager/analytics/manager-analytics-client.tsx",
        "src/app/(dashboard)/manager/compliance/page.tsx ×2",
        "src/app/(dashboard)/manager/skills/page.tsx ×2",
        "src/app/(dashboard)/profile/page.tsx",
        "src/app/(dashboard)/profile/settings/page.tsx",
        "src/app/(dashboard)/profile/skills/page.tsx",
        "src/app/api/admin/audit-log-namespaces/route.ts",
        "src/app/api/admin/lrs/[id]/sync/route.ts",
        "src/app/api/certificates/generate/route.ts",
        "src/app/api/certificates/verify/[code]/route.ts",
        "src/app/api/chat/sessions/[id]/messages/route.ts",
        "src/app/api/courses/[slug]/route.ts",
        "src/app/api/courses/route.ts",
        "src/app/api/cron/history/route.ts ×2",
        "src/app/api/discussions/route.ts",
        "src/app/api/embed/[token]/route.ts ×6",
        "src/app/api/enrollments/route.ts",
        "src/app/api/feedback/responses/route.ts ×2",
        "src/app/api/ilt-sessions/[id]/calendar/route.ts",
        "src/app/api/integrations/external/test/route.ts",
        "src/app/api/marketplace/enroll/route.ts",
        "src/app/api/marketplace/providers/route.ts",
        "src/app/api/mentorship/profiles/route.ts",
        "src/app/api/mentorship/sessions/[id]/route.ts",
        "src/app/api/recommendations/route.ts ×4",
        "src/app/api/teams/bot/route.ts",
        "src/app/embed/[token]/page.tsx ×11",
        "src/app/verify/[code]/page.tsx",
        "src/components/marketplace/unified-catalog.tsx",
        "src/lib/ai/recommendations.ts ×5",
        "src/lib/analytics/predictive.ts ×2",
        "src/lib/integrations/crm-sync.ts",
        "src/lib/mentorship/matching.ts",
        "src/lib/notifications/preferences.ts ×2",
      ]
    `);
  });
});
