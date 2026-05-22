import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { resolveAuditLogTenant } from "@/lib/audit-log/resolve-tenant";
import AuditLogClient from "./audit-log-client";
import type { AuditEntry } from "./audit-log-client";

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatAction(action: string): AuditEntry["action"] {
  const normalized = action.charAt(0).toUpperCase() + action.slice(1).toLowerCase();
  const valid = ["Created", "Updated", "Deleted", "Login", "Export", "System"];
  return (valid.includes(normalized) ? normalized : "System") as AuditEntry["action"];
}

function formatTimestamp(ts: string): string {
  const d = new Date(ts);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export default async function AuditLogPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const service = createServiceClient();
  const { data: dbUser } = await service
    .from("users")
    .select("id, role, organization_id, preferences")
    .eq("auth_id", user.id)
    .single();

  if (!dbUser) {
    redirect("/login");
  }

  if (dbUser.role !== "admin" && dbUser.role !== "super_admin") {
    redirect("/dashboard");
  }

  // Tenant scoping defaults:
  //   - super_admin: sees ALL tenants by default. An explicit x-tenant-id
  //     header narrows to one tenant if they want.
  //   - admin: scoped to their own organization_id by default. Can pass
  //     x-tenant-id to override (e.g. for cross-tenant troubleshooting).
  //   - other roles: blocked at the redirect above; if a future
  //     tenant-admin role gets through, getTenantScope provides the scope.
  //   Platform-level rows (tenant_id IS NULL: cron events, super_admin
  //   actions) remain visible to scoped admins via the .or() filter below.
  const hdrs = await headers();
  // Scope resolution lives in src/lib/audit-log/resolve-tenant.ts so
  // the rules (header overrides, admin defaults to own org, etc.) are
  // testable in isolation and stay consistent across any future readers.
  const tenantId = await resolveAuditLogTenant({
    role: dbUser.role,
    userId: dbUser.id,
    organizationId: (dbUser as any).organization_id ?? null,
    headerTenantId: hdrs.get("x-tenant-id"),
  });

  let auditQuery = service
    .from("audit_logs")
    .select("*, user:users!user_id(id, first_name, last_name, email)")
    .order("created_at", { ascending: false })
    .limit(100);
  if (tenantId) {
    // Include platform-level rows (tenant_id IS NULL) so the tenant admin
    // still sees system events that affect them.
    auditQuery = auditQuery.or(`tenant_id.eq.${tenantId},tenant_id.is.null`);
  }
  const { data: auditRows } = await auditQuery;

  const entries: AuditEntry[] = (auditRows ?? []).map((row: any) => {
    const u = row.user as any;
    const userName = u
      ? `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim() || u.email || "Unknown"
      : "System";
    const userAvatar = userName === "System" ? "SY" : getInitials(userName);

    const oldValues = row.old_values as Record<string, string> | null;
    const newValues = row.new_values as Record<string, string> | null;
    const hasDetails = oldValues || newValues;

    return {
      id: row.id,
      timestamp: formatTimestamp(row.created_at),
      userName,
      userAvatar,
      action: formatAction(row.action),
      entityType: row.entity_type,
      entityName: row.entity_id ?? row.entity_type,
      ipAddress: row.ip_address ?? "—",
      description: row.action,
      isPlatform: row.tenant_id == null,
      ...(hasDetails
        ? {
            details: {
              ...(oldValues ? { oldValue: oldValues } : {}),
              ...(newValues ? { newValue: newValues } : {}),
            },
          }
        : {}),
    };
  });

  // Initial value for the "Hide platform events" toggle. Persisted under
  // users.preferences.ui_prefs.hide_platform_audit via the existing
  // PATCH /api/profile path that other settings already use.
  const prefs = ((dbUser as any).preferences ?? {}) as Record<string, any>;
  const initialHidePlatform = !!prefs.ui_prefs?.hide_platform_audit;

  return <AuditLogClient entries={entries} initialHidePlatform={initialHidePlatform} />;
}
