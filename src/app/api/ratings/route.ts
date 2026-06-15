import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * GET /api/ratings/summary is handled here via ?summary=1 to keep one route.
 * GET /api/ratings?course_id=&class_id=  → average course/instructor stars +
 *   the caller's own rating (for showing on the class card / course page).
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const service = createServiceClient();
  const { data: profile } = await service.from("users").select("id").eq("auth_id", user.id).single();
  if (!profile) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { searchParams } = new URL(request.url);
  const courseId = searchParams.get("course_id");
  const classId = searchParams.get("class_id");
  if (!courseId && !classId) {
    return NextResponse.json({ error: "course_id or class_id is required" }, { status: 400 });
  }

  let query = service.from("course_ratings").select("user_id, course_rating, instructor_rating");
  if (classId) query = query.eq("class_id", classId);
  else if (courseId) query = query.eq("course_id", courseId);

  const { data: ratings, error } = await query;
  if (error) {
    console.error("Ratings summary error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  const courseVals = (ratings ?? []).map((r) => r.course_rating).filter((v): v is number => v != null);
  const instrVals = (ratings ?? []).map((r) => r.instructor_rating).filter((v): v is number => v != null);
  const avg = (a: number[]) => (a.length ? Math.round((a.reduce((x, y) => x + y, 0) / a.length) * 10) / 10 : null);

  const mine = (ratings ?? []).find((r) => r.user_id === profile.id) ?? null;

  return NextResponse.json({
    course_avg: avg(courseVals),
    course_count: courseVals.length,
    instructor_avg: avg(instrVals),
    instructor_count: instrVals.length,
    my_rating: mine ? { course_rating: mine.course_rating, instructor_rating: mine.instructor_rating } : null,
  });
}

/**
 * POST /api/ratings — submit or update the caller's rating for a delivery.
 * Body: { course_id, class_id?, session_id?, instructor_id?, course_rating?,
 *         instructor_rating?, comment? }
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const service = createServiceClient();
  const { data: profile } = await service.from("users").select("id").eq("auth_id", user.id).single();
  if (!profile) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const body = await request.json();
  const { course_id, class_id, session_id, instructor_id, course_rating, instructor_rating, comment } = body;

  if (!course_id) return NextResponse.json({ error: "course_id is required" }, { status: 400 });
  const valid = (v: unknown) => v == null || (Number.isInteger(v) && (v as number) >= 1 && (v as number) <= 5);
  if (!valid(course_rating) || !valid(instructor_rating)) {
    return NextResponse.json({ error: "Ratings must be whole numbers 1–5" }, { status: 400 });
  }
  if (course_rating == null && instructor_rating == null) {
    return NextResponse.json({ error: "Provide a course or instructor rating" }, { status: 400 });
  }

  // Denormalize tenant for client reporting.
  const { data: membership } = await service
    .from("tenant_memberships")
    .select("tenant_id")
    .eq("user_id", profile.id)
    .limit(1)
    .maybeSingle();

  // One rating per learner per delivery (class when present, else course).
  let existingQuery = service.from("course_ratings").select("id").eq("user_id", profile.id);
  existingQuery = class_id ? existingQuery.eq("class_id", class_id) : existingQuery.eq("course_id", course_id).is("class_id", null);
  const { data: existing } = await existingQuery.maybeSingle();

  const payload = {
    user_id: profile.id,
    course_id,
    class_id: class_id ?? null,
    session_id: session_id ?? null,
    instructor_id: instructor_id ?? null,
    tenant_id: membership?.tenant_id ?? null,
    course_rating: course_rating ?? null,
    instructor_rating: instructor_rating ?? null,
    comment: comment?.trim() || null,
    updated_at: new Date().toISOString(),
  };

  if (existing) {
    const { error } = await service.from("course_ratings").update(payload).eq("id", existing.id);
    if (error) {
      console.error("Rating update error:", error.message);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
  } else {
    const { error } = await service.from("course_ratings").insert(payload);
    if (error) {
      console.error("Rating insert error:", error.message);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
}
