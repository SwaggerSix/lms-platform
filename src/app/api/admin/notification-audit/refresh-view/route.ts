import { NextResponse } from "next/server";
import { authorize } from "@/lib/auth/authorize";
import { createServiceClient } from "@/lib/supabase/service";
import { logAudit } from "@/lib/audit";

/**
 * POST /api/admin/notification-audit/refresh-view
 *
 * Refreshes the notification_audit_rule_summary materialized view.
 * REFRESH MATERIALIZED VIEW CONCURRENTLY relies on the unique index added in
 * migration 20260318100035 — non-concurrent refresh as fallback if that
 * migration hasn't been applied.
 */
export async function POST() {
  const auth = await authorize("admin");
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const service = createServiceClient();

  // Try concurrent refresh first; fall back to a plain refresh if the
  // view doesn't yet have its unique index (matview migration not applied).
  let refreshError: string | null = null;
  let usedConcurrent = true;
  const { error: concErr } = await service.rpc("notification_audit_refresh_concurrent");
  if (concErr) {
    usedConcurrent = false;
    const { error: plainErr } = await service.rpc("notification_audit_refresh_plain");
    if (plainErr) refreshError = plainErr.message;
  }

  if (refreshError) {
    return NextResponse.json(
      {
        error:
          "View refresh failed. Make sure migrations 20260318100034 and 20260318100035 have been applied " +
          "and the helper RPCs notification_audit_refresh_* exist.",
        detail: refreshError,
      },
      { status: 500 }
    );
  }

  logAudit({
    userId: auth.user?.id,
    action: "refresh.notification_audit_view",
    entityType: "notification_audit",
    newValues: { concurrent: usedConcurrent },
  }).catch(() => {});

  return NextResponse.json({
    ok: true,
    concurrent: usedConcurrent,
  });
}
