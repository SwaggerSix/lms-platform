import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { resolveAuditLogTenant } from "@/lib/audit-log/resolve-tenant";
import { buildAuditLogTenantFilter } from "@/lib/audit-log/build-query-filter";
import { formatAction, formatTimestamp } from "@/lib/audit-log/format";
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

  // Row cap: bumped from 100 → 500 to make the on-page sample useful
  // for narrowing via filters. When the underlying table exceeds the
  // cap, the UI shows a banner telling the admin to tighten filters
  // (date range, action, entity, org). Without that signal the page
  // would silently truncate.
  const ROW_LIMIT = 500;
  let auditQuery = service
    .from("audit_logs")
    .select("*, user:users!user_id(id, first_name, last_name, email, organization_id, organization:organizations(id, name))", { count: "exact" })
    .order("created_at", { ascending: false })
    .limit(ROW_LIMIT);
  const tenantFilter = buildAuditLogTenantFilter(tenantId);
  if (tenantFilter) {
    auditQuery = auditQuery.or(tenantFilter);
  }
  const { data: auditRows, count: totalRowCount } = await auditQuery;

  const entries: AuditEntry[] = (auditRows ?? []).map((row: any) => {
    const u = row.user as any;
    const userName = u
      ? `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim() || u.email || "Unknown"
      : "System";
    const userAvatar = userName === "System" ? "SY" : getInitials(userName);
    const userOrgId = u?.organization_id ?? null;
    const userOrgName = u?.organization?.name ?? null;

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
      userOrganizationId: userOrgId,
      userOrganizationName: userOrgName,
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

  // Initial values for client-side filters. Persisted under
  // users.preferences.ui_prefs.{hide_platform_audit, entity_filter, org_filter}
  // via PATCH /api/profile so they stick across sessions. Strings default
  // to "All" — the client treats that as "no filter".
  const prefs = ((dbUser as any).preferences ?? {}) as Record<string, any>;
  const uiPrefs = (prefs.ui_prefs ?? {}) as Record<string, unknown>;
  const initialHidePlatform = !!uiPrefs.hide_platform_audit;
  const initialEntityFilter = typeof uiPrefs.entity_filter === "string" ? uiPrefs.entity_filter : "All";
  const initialOrgFilter = typeof uiPrefs.org_filter === "string" ? uiPrefs.org_filter : "All";
  const initialActionFilter = typeof uiPrefs.action_filter === "string" ? uiPrefs.action_filter : "All";

  // Server-rendered audit-log views must never serve a stale snapshot;
  // a page reload after an action should reflect the new row.
  return (
    <AuditLogClient
      entries={entries}
      initialHidePlatform={initialHidePlatform}
      initialEntityFilter={initialEntityFilter}
      initialOrgFilter={initialOrgFilter}
      initialActionFilter={initialActionFilter}
      rowLimit={ROW_LIMIT}
      totalRowCount={totalRowCount ?? entries.length}
    />
  );
}
