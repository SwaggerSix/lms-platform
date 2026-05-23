import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { walkFiles } from "./_walk";
import { LEGACY_ACTIONS } from "@/lib/audit-log/action-convention";
import { findActionLiteralOffenders } from "@/lib/audit-log/scan-action-literals";

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

describe("audit action naming convention", () => {
  it("every logAudit({ action: ... }) literal matches the convention", () => {
    const files = walkFiles(join(process.cwd(), "src/app/api"));
    const offenders: Array<{ file: string; action: string }> = [];

    for (const file of files) {
      const source = readFileSync(file, "utf8");
      const rel = file.replace(process.cwd() + "/", "");
      offenders.push(...findActionLiteralOffenders(rel, source));
    }

    expect(offenders, `Offenders: ${JSON.stringify(offenders, null, 2)}`).toEqual([]);
  });

  it("legacy verb set is the documented list", () => {
    // Lock the legacy set so adding a new bare verb requires touching
    // the test (and the implicit convention discussion).
    expect(Array.from(LEGACY_ACTIONS).sort()).toEqual([
      "created",
      "deleted",
      "export",
      "login",
      "updated",
    ]);
  });
});
