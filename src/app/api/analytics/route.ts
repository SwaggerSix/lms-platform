import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { authorize } from "@/lib/auth/authorize";
import { NextRequest, NextResponse } from "next/server";

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

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true }, { status: 201 });
}

export async function GET(request: NextRequest) {
  const auth = await authorize("admin");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabase = await createClient();
  const { searchParams } = new URL(request.url);

  const metric = searchParams.get("metric");

  if (metric === "overview") {
    const [users, courses, enrollments, completions] = await Promise.all([
      service.from("users").select("*", { count: "exact", head: true }).eq("status", "active"),
      service.from("courses").select("*", { count: "exact", head: true }).eq("status", "published"),
      service.from("enrollments").select("*", { count: "exact", head: true }),
      service.from("enrollments").select("*", { count: "exact", head: true }).eq("status", "completed"),
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
