import { createClient } from "@/lib/supabase/server";
import { authorizePermission } from "@/lib/auth/authorize-permission";
import { canAssignRole } from "@/lib/auth/roles";
import { NextRequest, NextResponse } from "next/server";
import { validateBody, createUserSchema } from "@/lib/validations";
import { createServiceClient } from "@/lib/supabase/service";
import { getTenantScope } from "@/lib/tenants/tenant-queries";
import { createUserAccount } from "@/lib/users/create-user";

export async function GET(request: NextRequest) {
  const auth = await authorizePermission("users.view", "admin", "manager");
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
  const auth = await authorizePermission("users.manage", "admin");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

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

  // Only Super Admins (gC/GGS) may grant the Super Admin role.
  if (validation.data.role && !canAssignRole(auth.user.role, validation.data.role)) {
    return NextResponse.json({ error: "You are not allowed to assign that role" }, { status: 403 });
  }

  const result = await createUserAccount(service, validation.data, auth.user.id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(
    { ...result.user, temporary_password: result.temporaryPassword },
    { status: 201 }
  );
}
