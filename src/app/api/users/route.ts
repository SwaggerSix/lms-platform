import { createClient } from "@/lib/supabase/server";
import { authorize } from "@/lib/auth/authorize";
import { NextRequest, NextResponse } from "next/server";
import { dispatchWebhook } from "@/lib/webhooks/dispatcher";
import { validateBody, createUserSchema } from "@/lib/validations";
import { createServiceClient } from "@/lib/supabase/service";
import { logAudit } from "@/lib/audit";
import { processRulesForUser } from "@/lib/automation/rules-engine";
import { getTenantScope } from "@/lib/tenants/tenant-queries";

export async function GET(request: NextRequest) {
  const auth = await authorize("admin", "manager");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabase = await createClient();
  const service = createServiceClient();
  const { searchParams } = new URL(request.url);
  const tenantScope = await getTenantScope(auth.user.id, auth.user.role, request);

  const role = searchParams.get("role");
  const status = searchParams.get("status") || "active";
  const search = searchParams.get("search");
  const orgId = searchParams.get("organization_id");
  const managerId = searchParams.get("manager_id");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const offset = (page - 1) * limit;

  let query = service
    .from("users")
    .select("id, first_name, last_name, email, role, status, job_title, avatar_url, organization_id, manager_id, hire_date, created_at, updated_at, preferences, organization:organizations(*)", { count: "exact" })
    .eq("status", status)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  // Apply tenant filtering — only show users in the same tenant
  if (tenantScope && tenantScope.userIds.length > 0) {
    query = query.in("id", tenantScope.userIds);
  } else if (tenantScope && tenantScope.userIds.length === 0) {
    return NextResponse.json({ users: [], total: 0, page });
  }

  if (role) query = query.eq("role", role);
  if (orgId) query = query.eq("organization_id", orgId);
  if (managerId) query = query.eq("manager_id", managerId);
  if (search) {
    const sanitizedSearch = search.replace(/[%_\\'"()]/g, "");
    query = query.or(`first_name.ilike.%${sanitizedSearch}%,last_name.ilike.%${sanitizedSearch}%,email.ilike.%${sanitizedSearch}%`);
  }

  const { data, count, error } = await query;

  if (error) {
    console.error("Users API error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ users: data, total: count, page });
}

export async function POST(request: NextRequest) {
  const auth = await authorize("admin");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabase = await createClient();
  const service = createServiceClient();
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const validation = validateBody(createUserSchema, body);
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  // Mass assignment fix: whitelist allowed fields
  const allowedFields = ["first_name", "last_name", "email", "role", "job_title", "organization_id", "manager_id", "status", "hire_date"];
  const sanitized = Object.fromEntries(
    Object.entries(validation.data).filter(([key]) => allowedFields.includes(key))
  );

  const { data, error } = await service
    .from("users")
    .insert(sanitized)
    .select()
    .single();

  if (error) {
    console.error("Users API error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  // Fire webhook (non-blocking)
  dispatchWebhook("user.created", {
    user_id: data.id,
    email: data.email,
  }).catch(() => {});

  logAudit({
    userId: auth.user.id,
    action: "created",
    entityType: "user",
    entityId: data.id,
    newValues: { email: data.email, role: data.role },
  });

  // Fire-and-forget: process automation rules for new user
  processRulesForUser(data.id, "user_created").catch((err) =>
    console.error("Automation rule processing failed:", err)
  );

  return NextResponse.json(data, { status: 201 });
}
