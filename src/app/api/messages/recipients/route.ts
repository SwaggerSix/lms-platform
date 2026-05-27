import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { NextRequest, NextResponse } from "next/server";
import { getTenantScope } from "@/lib/tenants/tenant-queries";

// Search active users to start a message with. Available to any authenticated
// user (not just admin/manager), scoped to the caller's tenant when one exists.
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const service = createServiceClient();
  const { data: profile } = await service
    .from("users")
    .select("id, role")
    .eq("auth_id", user.id)
    .single();
  if (!profile) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { searchParams } = new URL(request.url);
  const search = (searchParams.get("search") || "").trim();

  let query = service
    .from("users")
    .select("id, first_name, last_name, email")
    .eq("status", "active")
    .neq("id", profile.id)
    .order("first_name", { ascending: true })
    .limit(25);

  const tenantScope = await getTenantScope(profile.id, profile.role, request);
  if (tenantScope) {
    if (tenantScope.userIds.length === 0) {
      return NextResponse.json({ users: [] });
    }
    query = query.in("id", tenantScope.userIds);
  }

  if (search) {
    const sanitized = search.replace(/[%_\\'"()]/g, "");
    query = query.or(
      `first_name.ilike.%${sanitized}%,last_name.ilike.%${sanitized}%,email.ilike.%${sanitized}%`
    );
  }

  const { data, error } = await query;
  if (error) {
    console.error("Recipient search error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ users: data ?? [] });
}
