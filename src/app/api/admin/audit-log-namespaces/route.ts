import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/auth/authorize";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * GET /api/admin/audit-log-namespaces?hide_platform=true
 *
 * Returns every dotted-namespace action prefix found in audit_logs along
 * with its row count. The audit-log filter dropdown uses this so admins
 * can discover new action namespaces (e.g. "export.notification_audit_csv",
 * "refresh.notification_audit_view") even when they aren't on the current
 * page of entries.
 *
 * hide_platform=true filters out platform-level rows (tenant_id IS NULL)
 * so the returned counts reflect only tenant-scoped activity. Combine
 * with the audit-log page's "Hide platform events" toggle for accurate
 * scoped namespace counts without losing tenant-only prefixes.
 *
 * Aggregation is done in JS over up to 20000 rows. For larger deployments
 * this should move to a SQL view similar to notification_audit_rule_summary.
 */
export async function GET(request: NextRequest) {
  const auth = await authorize("admin");
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const url = new URL(request.url);
  const hidePlatform = url.searchParams.get("hide_platform") === "true";

  const service = createServiceClient();
  let query = service
    .from("audit_logs")
    .select("action, tenant_id")
    .order("created_at", { ascending: false })
    .limit(20000);
  if (hidePlatform) {
    query = query.not("tenant_id", "is", null);
  }
  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Legacy categories that already have a hardcoded dropdown entry — exclude
  // these so we don't emit duplicate options.
  const legacy = new Set(["created", "updated", "deleted", "login", "export"]);

  // Tally the top-level prefix (everything before the first dot) and
  // also tally every dotted-namespace path one level deeper. That gives
  // the UI both rollup ("replay") and per-leaf ("replay.cron_alerts")
  // options to filter by. Three-level actions like
  // "replay.cron_alerts.compliance-recurrence" still roll up to the
  // depth-2 "replay.cron_alerts" entry — we cap at depth 2 to keep the
  // dropdown bounded while still distinguishing the most useful split
  // (per-job replay variants).
  const counts = new Map<string, number>();
  const children = new Map<string, Set<string>>();
  for (const row of data ?? []) {
    const action = String((row as any).action ?? "");
    const parts = action.split(".");
    if (parts.length < 2) continue;
    const top = parts[0].toLowerCase();
    if (legacy.has(top)) continue;

    counts.set(top, (counts.get(top) ?? 0) + 1);
    if (parts.length >= 2) {
      const depth2 = `${parts[0]}.${parts[1]}`.toLowerCase();
      counts.set(depth2, (counts.get(depth2) ?? 0) + 1);
      const set = children.get(top) ?? new Set();
      set.add(depth2);
      children.set(top, set);
    }
  }

  // Emit as a flat list with a `parent` field so the client can render a
  // tree. Depth-2 entries point at their depth-1 parent.
  const namespaces: Array<{ prefix: string; count: number; parent: string | null }> = [];
  for (const [prefix, count] of counts.entries()) {
    const parent = prefix.includes(".") ? prefix.split(".")[0] : null;
    namespaces.push({ prefix, count, parent });
  }
  namespaces.sort((a, b) => {
    // Roots first (parent === null), then their children below.
    if (a.parent === null && b.parent !== null) return -1;
    if (a.parent !== null && b.parent === null) return 1;
    return b.count - a.count;
  });

  return NextResponse.json({
    namespaces,
    hide_platform: hidePlatform,
    /** True when we hit the 20k row cap; some older namespaces may be missing. */
    sample_capped: (data?.length ?? 0) >= 20000,
  });
}
