import { authorize } from "@/lib/auth/authorize";
import { createServiceClient } from "@/lib/supabase/service";
import { logAudit } from "@/lib/audit";
import { NextRequest, NextResponse } from "next/server";
import { processRulesForUser, evaluateRule, executeRuleActions } from "@/lib/automation/rules-engine";
import type { EnrollmentRule, UserRecord } from "@/lib/automation/rules-engine";

// GET: Get rule details with recent execution logs
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorize("admin");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const service = createServiceClient();

  const { data: rule, error } = await service
    .from("enrollment_rules")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !rule) {
    return NextResponse.json({ error: "Rule not found" }, { status: 404 });
  }

  // Fetch recent logs with user info
  const { data: logs } = await service
    .from("enrollment_rule_logs")
    .select("*, user:users(id, first_name, last_name, email)")
    .eq("rule_id", id)
    .order("created_at", { ascending: false })
    .limit(50);

  return NextResponse.json({ rule, logs: logs ?? [] });
}

// POST: Manually trigger rule execution for all matching users
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorize("admin");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const service = createServiceClient();

  // Fetch the rule
  const { data: rule, error: ruleErr } = await service
    .from("enrollment_rules")
    .select("*")
    .eq("id", id)
    .single();

  if (ruleErr || !rule) {
    return NextResponse.json({ error: "Rule not found" }, { status: 404 });
  }

  const typedRule = rule as EnrollmentRule;

  // Fetch all active users
  const { data: users } = await service
    .from("users")
    .select("id, role, organization_id, hire_date, job_title, status")
    .eq("status", "active");

  if (!users || users.length === 0) {
    return NextResponse.json({ message: "No active users found", matched: 0, executed: 0 });
  }

  // Fetch completed courses for condition evaluation
  const { data: allCompletedEnrollments } = await service
    .from("enrollments")
    .select("user_id, course_id")
    .eq("status", "completed");

  const completedByUser = new Map<string, string[]>();
  for (const e of allCompletedEnrollments ?? []) {
    const existing = completedByUser.get(e.user_id) ?? [];
    existing.push(e.course_id);
    completedByUser.set(e.user_id, existing);
  }

  let matched = 0;
  let executed = 0;
  let errors = 0;

  for (const user of users as UserRecord[]) {
    const completedCourseIds = completedByUser.get(user.id) ?? [];
    const matches = evaluateRule(typedRule, user, completedCourseIds);
    if (!matches) continue;
    matched++;

    const results = await executeRuleActions(typedRule, user.id);
    const successCount = results.filter((r) => r.status === "success").length;
    const errorCount = results.filter((r) => r.status === "error").length;
    executed += successCount;
    errors += errorCount;
  }

  // Update rule run stats
  await service
    .from("enrollment_rules")
    .update({
      last_run_at: new Date().toISOString(),
      run_count: (typedRule.run_count || 0) + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  logAudit({
    userId: auth.user.id,
    action: "manual_rule_execution",
    entityType: "enrollment_rule",
    entityId: id,
    newValues: { matched, executed, errors },
  });

  return NextResponse.json({ message: "Rule executed", matched, executed, errors });
}
