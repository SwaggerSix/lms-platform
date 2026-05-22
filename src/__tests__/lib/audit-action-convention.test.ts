import { describe, it, expect } from "vitest";
import {
  LEGACY_ACTIONS,
  isValidAuditAction,
  isValidAuditTemplateLiteralSource,
} from "@/lib/audit-log/action-convention";

/**
 * Unit tests for the audit-action naming convention helpers
 * themselves. The codebase-walking guard test only verifies that
 * existing call sites match the regex; this file pins the regex
 * behavior so accidental loosening (e.g. allowing camelCase) is
 * caught.
 */

describe("isValidAuditAction", () => {
  it("accepts every legacy bare verb", () => {
    for (const verb of LEGACY_ACTIONS) {
      expect(isValidAuditAction(verb), `legacy ${verb}`).toBe(true);
    }
  });

  it("accepts dotted lowercase namespaces", () => {
    const ok = [
      "profile.preferences.update",
      "replay.cron_alerts",
      "replay.cron_alerts.refresh-view",
      "rule.execute_manual",
      "workflow.execute",
      "a.b",
      "a.b.c.d.e",
      "a1.b2",
    ];
    for (const v of ok) {
      expect(isValidAuditAction(v), v).toBe(true);
    }
  });

  it("rejects bare snake_case without a dot", () => {
    const bad = ["manual_rule_execution", "executed_now", "some_thing", "a_b_c"];
    for (const v of bad) {
      expect(isValidAuditAction(v), v).toBe(false);
    }
  });

  it("rejects camelCase", () => {
    const bad = ["manualRuleExecution", "fooBar", "aB"];
    for (const v of bad) {
      expect(isValidAuditAction(v), v).toBe(false);
    }
  });

  it("rejects leading dot, trailing dot, or consecutive dots", () => {
    const bad = [".foo.bar", "foo.bar.", "foo..bar", ".", ".."];
    for (const v of bad) {
      expect(isValidAuditAction(v), v).toBe(false);
    }
  });

  it("rejects uppercase letters anywhere", () => {
    const bad = ["Foo.bar", "foo.Bar", "FOO.BAR"];
    for (const v of bad) {
      expect(isValidAuditAction(v), v).toBe(false);
    }
  });

  it("rejects empty string", () => {
    expect(isValidAuditAction("")).toBe(false);
  });

  it("rejects whitespace", () => {
    expect(isValidAuditAction("foo. bar")).toBe(false);
    expect(isValidAuditAction("foo bar")).toBe(false);
    expect(isValidAuditAction("foo.bar ")).toBe(false);
  });
});

describe("isValidAuditTemplateLiteralSource", () => {
  it("accepts dotted prefix with single interpolation tail", () => {
    expect(isValidAuditTemplateLiteralSource("`replay.cron_alerts.${jobName}`")).toBe(true);
    expect(isValidAuditTemplateLiteralSource("`a.b.${x}`")).toBe(true);
  });

  it("accepts hyphenated segments before interpolation", () => {
    expect(isValidAuditTemplateLiteralSource("`replay.cron_alerts.compliance-recurrence.${id}`")).toBe(true);
  });

  it("rejects template literals without a dot before ${}", () => {
    // Without the preceding dot, the runtime value would be a bare
    // identifier — exactly what the convention forbids.
    expect(isValidAuditTemplateLiteralSource("`replay_${jobName}`")).toBe(false);
    expect(isValidAuditTemplateLiteralSource("`${jobName}`")).toBe(false);
  });

  it("rejects unwrapped strings", () => {
    expect(isValidAuditTemplateLiteralSource("replay.cron_alerts.${jobName}")).toBe(false);
  });

  it("rejects uppercase prefixes", () => {
    expect(isValidAuditTemplateLiteralSource("`Replay.cron.${id}`")).toBe(false);
  });
});
