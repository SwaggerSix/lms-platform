import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/auth/authorize";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * GET /api/admin/notification-audit?limit=100&offset=0
 *
 * Surfaces historical send_notification action failures that look like they
 * were caused by the notifications.type CHECK-constraint violations that
 * the workflows engine and rules engine were silently emitting before the
 * fix in this branch.
 *
 * Pagination is per-source: limit/offset apply independently to both the
 * rule failures and the workflow failures. Defaults: limit=100, offset=0.
 * Maximum limit is 500.
 */
export async function GET(request: NextRequest) {
  const auth = await authorize("admin");
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const url = new URL(request.url);
  const limit = Math.min(500, Math.max(1, parseInt(url.searchParams.get("limit") ?? "100", 10) || 100));
  const offset = Math.max(0, parseInt(url.searchParams.get("offset") ?? "0", 10) || 0);

  const service = createServiceClient();

  // Rules engine failures.
  const [
    { data: ruleFailures, error: ruleErr, count: ruleCount },
    { data: workflowFailures, error: workflowErr, count: workflowCount },
  ] = await Promise.all([
    service
      .from("enrollment_rule_logs")
      .select("id, rule_id, user_id, action_type, status, error_message, created_at", { count: "exact" })
      .eq("action_type", "send_notification")
      .eq("status", "error")
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1),
    service
      .from("workflow_step_logs")
      .select("id, run_id, step_id, status, error_message, created_at", { count: "exact" })
      .eq("status", "failed")
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1),
  ]);

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

  // Group rule failures by rule_id within this page so the UI can show a
  // quick rule-level breakdown.
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
    page: { limit, offset },
    rules: {
      total: ruleCount ?? null,
      page_failures: ruleFailures?.length ?? 0,
      affected_rules_in_page: Object.values(ruleSummary),
      rows: ruleFailures ?? [],
      query_error: ruleErr?.message ?? null,
    },
    workflows: {
      total_failed_steps: workflowCount ?? null,
      page_failed_steps: workflowFailures?.length ?? 0,
      check_constraint_in_page: workflowCheckFailures.length,
      rows: workflowCheckFailures,
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
