import { NextResponse } from "next/server";
import { authorize } from "@/lib/auth/authorize";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * GET /api/admin/notification-audit
 *
 * Surfaces historical send_notification action failures that look like they
 * were caused by the notifications.type CHECK-constraint violations that
 * the workflows engine and rules engine were silently emitting before the
 * fix in this branch. Specifically:
 *
 *   - enrollment_rule_logs rows where action_type = "send_notification" and
 *     status = "error" — the rules engine was inserting type:"system" which
 *     the CHECK rejected, so the notification never landed.
 *   - workflow_step_logs rows where status = "failed" and the error_message
 *     mentions the type CHECK violation — workflows were inserting
 *     type:"workflow" which the CHECK rejected.
 *
 * Use this to identify rules/workflows that were running quietly broken so
 * you can decide whether to re-trigger them, audit the affected users, or
 * just confirm the new code path no longer produces these errors.
 */
export async function GET() {
  const auth = await authorize("admin");
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const service = createServiceClient();

  // Rules engine failures.
  const { data: ruleFailures, error: ruleErr } = await service
    .from("enrollment_rule_logs")
    .select("id, rule_id, user_id, action_type, status, error_message, created_at")
    .eq("action_type", "send_notification")
    .eq("status", "error")
    .order("created_at", { ascending: false })
    .limit(500);

  // Workflow failures — broader filter since the table doesn't separate
  // action types; we filter by error message after fetching.
  const { data: workflowFailures, error: workflowErr } = await service
    .from("workflow_step_logs")
    .select("id, run_id, step_id, status, error_message, created_at")
    .eq("status", "failed")
    .order("created_at", { ascending: false })
    .limit(500);

  const checkLike = (msg: string | null) => {
    if (!msg) return false;
    const m = msg.toLowerCase();
    return (
      m.includes("check constraint") ||
      m.includes("notifications_type_check") ||
      (m.includes("violates") && m.includes("type"))
    );
  };

  const workflowCheckFailures = (workflowFailures ?? []).filter((r: any) => checkLike(r.error_message));

  // Group rule failures by rule_id to identify which rules were affected.
  const ruleSummary: Record<string, { rule_id: string; failures: number; latest: string }> = {};
  for (const row of ruleFailures ?? []) {
    const slot = ruleSummary[(row as any).rule_id] ?? {
      rule_id: (row as any).rule_id,
      failures: 0,
      latest: (row as any).created_at,
    };
    slot.failures += 1;
    if ((row as any).created_at > slot.latest) slot.latest = (row as any).created_at;
    ruleSummary[(row as any).rule_id] = slot;
  }

  return NextResponse.json({
    rules: {
      total_failures: ruleFailures?.length ?? 0,
      affected_rules: Object.values(ruleSummary),
      sample_rows: (ruleFailures ?? []).slice(0, 20),
      query_error: ruleErr?.message ?? null,
    },
    workflows: {
      total_failures: workflowFailures?.length ?? 0,
      check_constraint_failures: workflowCheckFailures.length,
      sample_rows: workflowCheckFailures.slice(0, 20),
      query_error: workflowErr?.message ?? null,
    },
    notes: [
      "Rules engine previously inserted notifications.type = 'system'.",
      "Workflows engine previously inserted notifications.type = 'workflow'.",
      "Both values violate the notifications.type CHECK constraint, so the inserts rejected.",
      "This branch changes both to use 'announcement', which the CHECK allows.",
    ],
  });
}
