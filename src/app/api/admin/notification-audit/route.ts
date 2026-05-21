import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/auth/authorize";
import { createServiceClient } from "@/lib/supabase/service";
import { logAudit } from "@/lib/audit";
import { getTenantScope } from "@/lib/tenants/tenant-queries";

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
  const format = url.searchParams.get("format");
  const limit = Math.min(500, Math.max(1, parseInt(url.searchParams.get("limit") ?? "100", 10) || 100));
  const offset = Math.max(0, parseInt(url.searchParams.get("offset") ?? "0", 10) || 0);

  const service = createServiceClient();

  // Tenant scoping: super_admin/admin see everything (scope is null). For
  // narrower roles the x-tenant-id header or the user's primary tenant
  // membership determines which users' logs they can see. Rule logs are
  // filtered by user_id; workflow logs are NOT scoped (the run→workflow
  // chain doesn't carry tenant info today) and are returned in full when
  // the caller has admin auth.
  const tenantScope = auth.user
    ? await getTenantScope(auth.user.id, auth.user.role, request).catch(() => null)
    : null;
  const tenantUserIds = tenantScope?.userIds ?? null;
  const tenantId = tenantScope?.tenantId ?? null;

  // Workflow step logs now carry tenant_id directly (denormalized via the
  // trigger added in migration 20260318100038). A NULL tenant_id means
  // platform-wide and is visible to every scoped admin.
  // Typed loosely because the helper is applied at various chain stages
  // (.select().eq().range()) — the supabase-js type for filter builders
  // is too narrow to express that uniformly.
  const applyWorkflowTenantFilter = <T>(q: T): T => {
    if (!tenantId) return q;
    return (q as any).or(`tenant_id.eq.${tenantId},tenant_id.is.null`) as T;
  };

  // CSV export path: stream up to 5000 rule failures + 5000 workflow CHECK
  // failures into a single CSV (two sections separated by a blank line).
  if (format === "csv") {
    let ruleCsvQuery = service
      .from("enrollment_rule_logs")
      .select("id, rule_id, user_id, error_message, created_at")
      .eq("action_type", "send_notification")
      .eq("status", "error")
      .order("created_at", { ascending: false })
      .limit(5000);
    if (tenantUserIds) {
      ruleCsvQuery = ruleCsvQuery.in("user_id", tenantUserIds.length > 0 ? tenantUserIds : ["__none__"]);
    }
    const workflowCsvQuery = applyWorkflowTenantFilter(
      service
        .from("workflow_step_logs")
        .select("id, run_id, step_id, error_message, created_at")
        .eq("status", "failed")
        .order("created_at", { ascending: false })
        .limit(5000) as any
    );
    const [
      { data: ruleAll, error: ruleAllErr },
      { data: workflowAll, error: workflowAllErr },
    ] = await Promise.all([ruleCsvQuery, workflowCsvQuery]);

    if (ruleAllErr || workflowAllErr) {
      return NextResponse.json(
        { error: ruleAllErr?.message ?? workflowAllErr?.message ?? "query error" },
        { status: 500 }
      );
    }

    const escape = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines: string[] = [];

    lines.push("# Rule send_notification failures");
    lines.push(["id", "rule_id", "user_id", "error_message", "created_at"].map(escape).join(","));
    for (const r of (ruleAll ?? []) as any[]) {
      lines.push(
        [r.id, r.rule_id, r.user_id, r.error_message ?? "", r.created_at].map(escape).join(",")
      );
    }
    lines.push("");
    lines.push("# Workflow step failures (CHECK-constraint filtered)");
    lines.push(["id", "run_id", "step_id", "error_message", "created_at"].map(escape).join(","));
    const checkLike = (msg: string | null) => {
      if (!msg) return false;
      const m = msg.toLowerCase();
      return (
        m.includes("check constraint") ||
        m.includes("notifications_type_check") ||
        (m.includes("violates") && m.includes("type"))
      );
    };
    for (const w of (workflowAll ?? []) as any[]) {
      if (!checkLike(w.error_message)) continue;
      lines.push(
        [w.id, w.run_id, w.step_id, w.error_message ?? "", w.created_at].map(escape).join(",")
      );
    }

    const csv = lines.join("\n");

    // Log the export so we have an audit trail of who pulled the data.
    const workflowCheckCount = (workflowAll ?? []).filter((w: any) => checkLike(w.error_message)).length;
    logAudit({
      userId: auth.user?.id,
      action: "export.notification_audit_csv",
      entityType: "notification_audit",
      ipAddress:
        request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? undefined,
      newValues: {
        rule_rows: (ruleAll ?? []).length,
        workflow_rows_check_filtered: workflowCheckCount,
      },
    }).catch(() => {});

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="notification-audit-${new Date()
          .toISOString()
          .slice(0, 10)}.csv"`,
      },
    });
  }

  // Rules engine failures (paginated rows + all-time aggregation).
  let rulePageQuery = service
    .from("enrollment_rule_logs")
    .select("id, rule_id, user_id, action_type, status, error_message, created_at", { count: "exact" })
    .eq("action_type", "send_notification")
    .eq("status", "error")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (tenantUserIds) {
    rulePageQuery = rulePageQuery.in("user_id", tenantUserIds.length > 0 ? tenantUserIds : ["__none__"]);
  }
  const workflowPageQuery = applyWorkflowTenantFilter(
    service
      .from("workflow_step_logs")
      .select("id, run_id, step_id, status, error_message, created_at", { count: "exact" })
      .eq("status", "failed")
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1) as any
  );
  const [
    { data: ruleFailures, error: ruleErr, count: ruleCount },
    { data: workflowFailures, error: workflowErr, count: workflowCount },
    { data: ruleAggRows, error: ruleAggErr },
  ] = await Promise.all([
    rulePageQuery,
    workflowPageQuery,
    // All-time rule aggregation: prefer the notification_audit_rule_summary
    // view (added in 20260318100034). Falls back to a 5000-row sample of
    // raw rows when the view doesn't exist (older deployments).
    service
      .from("notification_audit_rule_summary")
      .select("rule_id, failures, latest")
      .order("failures", { ascending: false })
      .limit(20),
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

  // All-time rule aggregation. The materialized view returns
  // {rule_id, failures, latest} pre-aggregated globally, so we can only
  // use it when there's no tenant scope. With scope, we have to scan raw
  // rows so we can filter by user_id and re-aggregate in JS.
  let topAffectedRules: { rule_id: string; failures: number; latest: string }[] = [];
  let aggregationCapped = false;
  const viewMissing =
    !!ruleAggErr?.message && /relation .*notification_audit_rule_summary.* does not exist/i.test(ruleAggErr.message);

  if (!tenantUserIds && !viewMissing && ruleAggRows && Array.isArray(ruleAggRows)) {
    topAffectedRules = (ruleAggRows as any[]).map((r) => ({
      rule_id: r.rule_id,
      failures: Number(r.failures) || 0,
      latest: r.latest,
    }));
  } else {
    // Fallback / scoped path: scan up to 5000 raw rows and bucket in JS.
    let fbQuery = service
      .from("enrollment_rule_logs")
      .select("rule_id, user_id, created_at")
      .eq("action_type", "send_notification")
      .eq("status", "error")
      .order("created_at", { ascending: false })
      .limit(5000);
    if (tenantUserIds) {
      fbQuery = fbQuery.in("user_id", tenantUserIds.length > 0 ? tenantUserIds : ["__none__"]);
    }
    const { data: fallback } = await fbQuery;
    const allTimeMap: Record<string, { rule_id: string; failures: number; latest: string }> = {};
    for (const row of fallback ?? []) {
      const slot = allTimeMap[(row as any).rule_id] ?? {
        rule_id: (row as any).rule_id,
        failures: 0,
        latest: (row as any).created_at,
      };
      slot.failures += 1;
      if ((row as any).created_at > slot.latest) slot.latest = (row as any).created_at;
      allTimeMap[(row as any).rule_id] = slot;
    }
    topAffectedRules = Object.values(allTimeMap)
      .sort((a, b) => b.failures - a.failures)
      .slice(0, 20);
    aggregationCapped = (fallback?.length ?? 0) >= 5000;
  }

  return NextResponse.json({
    page: { limit, offset },
    tenant_scope: tenantId
      ? {
          tenant_id: tenantId,
          user_count: tenantUserIds?.length ?? 0,
          /** Workflow logs filtered directly via workflow_step_logs.tenant_id (own tenant + NULL/platform-wide). */
          workflow_logs_scoped: true,
        }
      : null,
    rules: {
      total: ruleCount ?? null,
      page_failures: ruleFailures?.length ?? 0,
      affected_rules_in_page: Object.values(ruleSummary),
      top_affected_rules_all_time: topAffectedRules,
      aggregation_capped_at_5000: aggregationCapped,
      aggregation_query_error: ruleAggErr?.message ?? null,
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
