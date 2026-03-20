import { authorize } from "@/lib/auth/authorize";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function GET(request: NextRequest) {
  const auth = await authorize();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const service = createServiceClient();
  const { searchParams } = new URL(request.url);

  const search = searchParams.get("search");
  const providerId = searchParams.get("provider_id");
  const difficulty = searchParams.get("difficulty");
  const topic = searchParams.get("topic");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 50);
  const offset = (page - 1) * limit;

  let query = service
    .from("marketplace_courses")
    .select("*, provider:marketplace_providers(id, name, provider_type)", { count: "exact" })
    .eq("is_active", true)
    .order("rating", { ascending: false, nullsFirst: false })
    .range(offset, offset + limit - 1);

  if (providerId) query = query.eq("provider_id", providerId);
  if (difficulty) query = query.eq("difficulty", difficulty);
  if (topic) query = query.contains("topics", [topic]);
  if (search) {
    const sanitized = search.replace(/[%_\\'"()]/g, "");
    query = query.ilike("title", `%${sanitized}%`);
  }

  const { data, count, error } = await query;

  if (error) {
    console.error("Marketplace courses GET error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  // Get user enrollments for these courses
  const courseIds = (data ?? []).map((c) => c.id);
  let enrollmentMap: Record<string, { status: string; progress: number }> = {};

  if (courseIds.length > 0) {
    const { data: enrollments } = await service
      .from("marketplace_enrollments")
      .select("marketplace_course_id, status, progress")
      .eq("user_id", auth.user.id)
      .in("marketplace_course_id", courseIds);

    for (const e of enrollments ?? []) {
      enrollmentMap[e.marketplace_course_id] = { status: e.status, progress: Number(e.progress) };
    }
  }

  const courses = (data ?? []).map((c) => ({
    ...c,
    user_enrollment: enrollmentMap[c.id] || null,
  }));

  return NextResponse.json({
    courses,
    total: count,
    page,
    totalPages: Math.ceil((count || 0) / limit),
  });
}
