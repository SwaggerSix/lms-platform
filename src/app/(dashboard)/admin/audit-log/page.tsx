import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
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

// Maps a DataTable column key to the DB column used for server-side sort.
const SORT_COLUMNS: Record<string, string> = {
  timestamp: "created_at",
  action: "action",
  entityType: "entity_type",
  entityName: "entity_id",
};

const ACTION_FILTERS = ["created", "updated", "deleted", "login", "export"];

const PAGE_SIZE = 25;

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const sp = await searchParams;
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
    .select("id, role")
    .eq("auth_id", user.id)
    .single();

  if (!dbUser) {
    redirect("/login");
  }

  if (dbUser.role !== "admin" && dbUser.role !== "super_admin") {
    redirect("/dashboard");
  }

  // ─── Server-driven paging / filtering / sorting (same pattern as /admin/users) ───
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  // Sanitize search: PostgREST .or()/ilike break on , ( ) % * \, so strip them.
  const q = (sp.q ?? "").replace(/[,()%*\\]/g, " ").trim();
  const actionParam =
    sp.action && ACTION_FILTERS.includes(sp.action.toLowerCase())
      ? sp.action.toLowerCase()
      : null;
  const entityParam = (sp.entity ?? "").replace(/[,()%*\\]/g, " ").trim() || null;
  // Date bounds arrive as yyyy-mm-dd from <input type="date">.
  const from = /^\d{4}-\d{2}-\d{2}$/.test(sp.from ?? "") ? sp.from! : null;
  const to = /^\d{4}-\d{2}-\d{2}$/.test(sp.to ?? "") ? sp.to! : null;
  const sort = sp.sort ?? "-timestamp";
  const sortDesc = sort.startsWith("-");
  const sortField = SORT_COLUMNS[sort.replace(/^-/, "")] ?? "created_at";

  // Searching by user requires an inner join so the name/email filter applies
  // to the joined row; without a search we keep the left join so "System"
  // entries (null user) still appear.
  const userSelect = q
    ? "*, user:users!user_id!inner(id, first_name, last_name, email)"
    : "*, user:users!user_id(id, first_name, last_name, email)";

  let query = service.from("audit_logs").select(userSelect, { count: "exact" });

  if (q) {
    query = query.or(
      `first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%`,
      { referencedTable: "user" }
    );
  }
  // ilike with no wildcard = case-insensitive equality.
  if (actionParam) query = query.ilike("action", actionParam);
  if (entityParam) query = query.ilike("entity_type", entityParam);
  if (from) query = query.gte("created_at", from);
  if (to) query = query.lte("created_at", `${to}T23:59:59.999`);

  const { data: auditRows, count } = await query
    .order(sortField, { ascending: !sortDesc })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

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

  return (
    <AuditLogClient
      entries={entries}
      totalCount={count ?? entries.length}
      page={page}
      pageSize={PAGE_SIZE}
      sort={sort}
    />
  );
}
