import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

function walkTs(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) out.push(...walkTs(p));
    else if (s.isFile() && p.endsWith(".ts")) out.push(p);
  }
  return out;
}

/**
 * Naming convention for audit_logs.action across the codebase:
 *
 *   - Bare verbs: created, updated, deleted, login, export (legacy
 *     conventions; entity_type provides context).
 *   - Dotted lowercase namespaces: e.g. profile.preferences.update,
 *     replay.cron_alerts, refresh.notification_audit_view.
 *   - Dotted namespaces MAY contain hyphens (e.g.
 *     "replay.cron_alerts.compliance-recurrence") since job names
 *     use them.
 *
 * Snake_case (without a dot) and camelCase are NOT allowed — they
 * fragment the audit-log filter's namespace tree.
 *
 * This test scans every "action: \"...\"" literal under src/app/api/
 * and asserts each value matches one of the legacy verbs or the
 * dotted-namespace shape. Catches regressions before they reach
 * audit_logs.
 */

const LEGACY = new Set(["created", "updated", "deleted", "login", "export"]);
const DOTTED_RE = /^[a-z][a-z0-9_-]*(\.[a-z0-9][a-z0-9_-]*)+$/;
// Template-string actions (computed at runtime) are also acceptable
// when the prefix is dotted — e.g. `replay.cron_alerts.${jobName}`.
const TEMPLATE_LITERAL_RE = /^`[a-z][a-z0-9_.-]*(\.[a-z0-9][a-z0-9_-]*)*\.\$\{[^}]+\}`$/;

describe("audit action naming convention", () => {
  it("every logAudit({ action: ... }) literal matches the convention", () => {
    const files = walkTs(join(process.cwd(), "src/app/api"));
    const offenders: Array<{ file: string; action: string }> = [];

    // Match both string-literal and template-literal action values.
    const STRING_LITERAL = /action:\s*"([^"]+)"/g;
    const TEMPLATE_LITERAL = /action:\s*(`[^`]+`)/g;

    for (const file of files) {
      const source = readFileSync(file, "utf8");
      for (const m of source.matchAll(STRING_LITERAL)) {
        const v = m[1];
        if (LEGACY.has(v) || DOTTED_RE.test(v)) continue;
        offenders.push({ file: file.replace(process.cwd() + "/", ""), action: v });
      }
      for (const m of source.matchAll(TEMPLATE_LITERAL)) {
        const v = m[1];
        if (TEMPLATE_LITERAL_RE.test(v)) continue;
        // Some template literals just wrap a single legacy verb in
        // backticks. That's fine.
        const stripped = v.replace(/^`|`$/g, "");
        if (!stripped.includes("${") && (LEGACY.has(stripped) || DOTTED_RE.test(stripped))) continue;
        offenders.push({ file: file.replace(process.cwd() + "/", ""), action: v });
      }
    }

    expect(offenders, `Offenders: ${JSON.stringify(offenders, null, 2)}`).toEqual([]);
  });

  it("legacy verb set is the documented list", () => {
    // Lock the legacy set so adding a new bare verb requires touching
    // the test (and the implicit convention discussion).
    expect(Array.from(LEGACY).sort()).toEqual([
      "created",
      "deleted",
      "export",
      "login",
      "updated",
    ]);
  });
});
