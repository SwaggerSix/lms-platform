import { NextResponse } from "next/server";
import { authorize } from "@/lib/auth/authorize";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * GET /api/admin/audit-log-namespaces
 *
 * Returns every dotted-namespace action prefix found in audit_logs along
 * with its row count. The audit-log filter dropdown uses this so admins
 * can discover new action namespaces (e.g. "export.notification_audit_csv",
 * "refresh.notification_audit_view") even when they aren't on the current
 * page of entries.
 *
 * Aggregation is done in JS over up to 20000 rows. For larger deployments
 * this should move to a SQL view similar to notification_audit_rule_summary.
 */
export async function GET() {
  const auth = await authorize("admin");
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const service = createServiceClient();
  const { data, error } = await service
    .from("audit_logs")
    .select("action")
    .order("created_at", { ascending: false })
    .limit(20000);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Legacy categories that already have a hardcoded dropdown entry — exclude
  // these so we don't emit duplicate options.
  const legacy = new Set(["created", "updated", "deleted", "login", "export"]);

  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    const action = String((row as any).action ?? "");
    const dot = action.indexOf(".");
    if (dot <= 0) continue;
    const prefix = action.slice(0, dot).toLowerCase();
    if (legacy.has(prefix)) continue;
    counts.set(prefix, (counts.get(prefix) ?? 0) + 1);
  }

  const namespaces = Array.from(counts.entries())
    .map(([prefix, count]) => ({ prefix, count }))
    .sort((a, b) => b.count - a.count);

  return NextResponse.json({
    namespaces,
    /** True when we hit the 20k row cap; some older namespaces may be missing. */
    sample_capped: (data?.length ?? 0) >= 20000,
  });
}
