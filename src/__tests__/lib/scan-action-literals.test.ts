import { describe, it, expect } from "vitest";
import { findActionLiteralOffenders } from "@/lib/audit-log/scan-action-literals";

/**
 * The codebase-walking test in audit-action-conventions.test.ts only
 * proves the live tree is clean; it cannot prove that a hypothetical
 * regression would be caught. These tests feed crafted source strings
 * to the scanner and assert it flags the expected offenders.
 */

describe("findActionLiteralOffenders", () => {
  it("returns empty when every action is a legacy verb", () => {
    const src = `
      logAudit({ action: "created", entityType: "x" });
      logAudit({ action: "updated", entityType: "y" });
      logAudit({ action: "deleted", entityType: "z" });
    `;
    expect(findActionLiteralOffenders("f.ts", src)).toEqual([]);
  });

  it("returns empty when every action is a dotted namespace", () => {
    const src = `
      logAudit({ action: "profile.preferences.update", entityType: "p" });
      logAudit({ action: "replay.cron_alerts.refresh-view", entityType: "c" });
    `;
    expect(findActionLiteralOffenders("f.ts", src)).toEqual([]);
  });

  it("flags snake_case bare action", () => {
    const src = `logAudit({ action: "manual_thing", entityType: "x" });`;
    expect(findActionLiteralOffenders("f.ts", src)).toEqual([
      { file: "f.ts", action: "manual_thing" },
    ]);
  });

  it("flags camelCase bare action", () => {
    const src = `logAudit({ action: "doThing", entityType: "x" });`;
    expect(findActionLiteralOffenders("f.ts", src)).toEqual([
      { file: "f.ts", action: "doThing" },
    ]);
  });

  it("accepts template literal with dotted prefix and interpolation", () => {
    const src = `logAudit({ action: \`replay.cron_alerts.\${jobName}\`, entityType: "c" });`;
    expect(findActionLiteralOffenders("f.ts", src)).toEqual([]);
  });

  it("flags template literal whose prefix is not dotted before ${}", () => {
    const src = `logAudit({ action: \`replay_\${jobName}\`, entityType: "c" });`;
    const result = findActionLiteralOffenders("f.ts", src);
    expect(result).toHaveLength(1);
    expect(result[0].file).toBe("f.ts");
    expect(result[0].action).toMatch(/^`replay_\$\{jobName\}`$/);
  });

  it("accepts template literal with no interpolation that wraps a legacy verb", () => {
    const src = `logAudit({ action: \`created\`, entityType: "x" });`;
    expect(findActionLiteralOffenders("f.ts", src)).toEqual([]);
  });

  it("flags multiple offenders in a single source", () => {
    const src = `
      logAudit({ action: "ok.dotted", entityType: "a" });
      logAudit({ action: "bad_snake", entityType: "b" });
      logAudit({ action: "anotherBad", entityType: "c" });
      logAudit({ action: "ok2.dotted.namespace", entityType: "d" });
    `;
    const result = findActionLiteralOffenders("multi.ts", src);
    expect(result.map((o) => o.action)).toEqual(["bad_snake", "anotherBad"]);
    expect(result.every((o) => o.file === "multi.ts")).toBe(true);
  });

  it("does not flag identifiers that aren't preceded by `action:`", () => {
    // A regression where the regex matched any quoted string. Make sure
    // arbitrary quoted strings in source aren't false-positived.
    const src = `
      const label = "snake_case_name";
      doThing({ name: "another_snake" });
    `;
    expect(findActionLiteralOffenders("f.ts", src)).toEqual([]);
  });
});
