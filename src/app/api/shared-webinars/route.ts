import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/auth/authorize";
import { createServiceClient } from "@/lib/supabase/service";

/** Resolve the caller's tenant (client instance), or null for platform staff. */
async function resolveTenant(service: ReturnType<typeof createServiceClient>, userId: string) {
  const { data } = await service
    .from("tenant_memberships")
    .select("tenant_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  return data?.tenant_id ?? null;
}

/**
 * GET /api/shared-webinars
 * Lists shared (cross-instance) free webinars with this client instance's
 * opt-in status, so an admin can choose which to offer their learners.
 */
export async function GET() {
  const auth = await authorize("admin", "super_admin", "manager");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const service = createServiceClient();
  const tenantId = await resolveTenant(service, auth.user.id);

  const { data: webinars, error } = await service
    .from("ilt_sessions")
    .select("id, title, description, session_date, start_time, end_time, timezone, location_type, is_free, max_capacity, course:courses(title)")
    .eq("is_shared", true)
    .neq("status", "cancelled")
    .order("session_date", { ascending: true });
  if (error) {
    console.error("Shared webinars GET error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  let optedIn = new Set<string>();
  if (tenantId) {
    const { data: optins } = await service
      .from("shared_webinar_optins")
      .select("session_id")
      .eq("tenant_id", tenantId)
      .eq("opted_in", true);
    optedIn = new Set((optins ?? []).map((o) => o.session_id));
  }

  const list = (webinars ?? []).map((w) => {
    const course = Array.isArray(w.course) ? w.course[0] : (w.course as any);
    return {
      id: w.id,
      title: w.title,
      description: w.description,
      course_title: course?.title ?? null,
      session_date: w.session_date,
      start_time: w.start_time,
      end_time: w.end_time,
      timezone: w.timezone,
      location_type: w.location_type,
      is_free: w.is_free,
      max_capacity: w.max_capacity,
      opted_in: optedIn.has(w.id),
    };
  });

  return NextResponse.json({ tenant_id: tenantId, webinars: list });
}

/**
 * POST /api/shared-webinars — opt this client instance in/out of a shared webinar.
 * Body: { session_id, opted_in }
 */
export async function POST(request: NextRequest) {
  const auth = await authorize("admin", "super_admin", "manager");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const service = createServiceClient();
  const tenantId = await resolveTenant(service, auth.user.id);
  if (!tenantId) {
    return NextResponse.json({ error: "You must belong to a client instance to opt into shared webinars." }, { status: 400 });
  }

  const { session_id, opted_in } = await request.json();
  if (!session_id) return NextResponse.json({ error: "session_id is required" }, { status: 400 });

  const { error } = await service.from("shared_webinar_optins").upsert(
    {
      session_id,
      tenant_id: tenantId,
      opted_in: opted_in !== false,
      opted_in_at: new Date().toISOString(),
      opted_in_by: auth.user.id,
    },
    { onConflict: "session_id,tenant_id" }
  );
  if (error) {
    console.error("Shared webinar optin error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
