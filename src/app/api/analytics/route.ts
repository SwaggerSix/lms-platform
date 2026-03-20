import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { authorize } from "@/lib/auth/authorize";
import { NextRequest, NextResponse } from "next/server";
import { getTenantScope } from "@/lib/tenants/tenant-queries";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const body = await request.json();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const service = createServiceClient();
  const { data: profile } = await service.from("users").select("id").eq("auth_id", user.id).single();

  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { error } = await service.from("analytics_events").insert({
    user_id: profile.id,
    event_type: body.event_type,
    entity_type: body.entity_type || null,
    entity_id: body.entity_id || null,
    metadata: body.metadata || {},
    session_id: body.session_id || null,
  });

  if (error) {
    console.error("Analytics API error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
  return NextResponse.json({ success: true }, { status: 201 });
}

export async function GET(request: NextRequest) {
  const auth = await authorize("admin");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const tenantScope = await getTenantScope(auth.user.id, auth.user.role, request);

  const supabase = await createClient();
  const service = createServiceClient();
  const { searchParams } = new URL(request.url);

  const metric = searchParams.get("metric");

  if (metric === "overview") {
    let usersQuery = service.from("users").select("*", { count: "exact", head: true }).eq("status", "active");
    let coursesQuery = service.from("courses").select("*", { count: "exact", head: true }).eq("status", "published");
    let enrollmentsQuery = service.from("enrollments").select("*", { count: "exact", head: true });
    let completionsQuery = service.from("enrollments").select("*", { count: "exact", head: true }).eq("status", "completed");

    if (tenantScope) {
      usersQuery = usersQuery.in("id", tenantScope.userIds);
      coursesQuery = coursesQuery.in("id", tenantScope.courseIds);
      enrollmentsQuery = enrollmentsQuery.in("user_id", tenantScope.userIds);
      completionsQuery = completionsQuery.in("user_id", tenantScope.userIds);
    }

    const [users, courses, enrollments, completions] = await Promise.all([
      usersQuery,
      coursesQuery,
      enrollmentsQuery,
      completionsQuery,
    ]);

    return NextResponse.json({
      total_users: users.count || 0,
      active_courses: courses.count || 0,
      total_enrollments: enrollments.count || 0,
      total_completions: completions.count || 0,
      completion_rate:
        enrollments.count && completions.count
          ? Math.round((completions.count / enrollments.count) * 100)
          : 0,
    });
  }

  return NextResponse.json({ error: "Unknown metric" }, { status: 400 });
}
