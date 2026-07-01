import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/auth/authorize";
import { createServiceClient } from "@/lib/supabase/service";

// Only admins, super admins and (project) managers may view or modify
// subcontractor course certifications. super_admin is always allowed by
// authorize(); the rest are gated explicitly.
const STAFF = ["admin", "super_admin", "manager"] as const;

function isStaff(role: string): boolean {
  return (STAFF as readonly string[]).includes(role);
}

/**
 * GET /api/subcontractor-certifications?user_id=X
 * Returns every course certification recorded for the given subcontractor.
 */
export async function GET(request: NextRequest) {
  const auth = await authorize();
  if (!auth.authorized)
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!isStaff(auth.user.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const userId = new URL(request.url).searchParams.get("user_id");
  if (!userId)
    return NextResponse.json({ error: "user_id is required" }, { status: 400 });

  const service = createServiceClient();
  const { data, error } = await service
    .from("subcontractor_course_certifications")
    .select("id, user_id, course_id, certified_date, certified_by, created_at, updated_at")
    .eq("user_id", userId);

  if (error) {
    console.error("Subcontractor certs GET error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
  return NextResponse.json({ certifications: data ?? [] });
}

/**
 * POST /api/subcontractor-certifications
 * Body: { user_id, course_id, certified_date? }
 * Marks a subcontractor certified for a course (idempotent upsert on the
 * user/course pair). Used both when first checking the box and when the date
 * is subsequently set or changed.
 */
export async function POST(request: NextRequest) {
  const auth = await authorize();
  if (!auth.authorized)
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!isStaff(auth.user.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null);
  if (!body?.user_id || !body?.course_id)
    return NextResponse.json(
      { error: "user_id and course_id are required" },
      { status: 400 }
    );

  const service = createServiceClient();
  const { data, error } = await service
    .from("subcontractor_course_certifications")
    .upsert(
      {
        user_id: body.user_id,
        course_id: body.course_id,
        certified_date: body.certified_date || null,
        certified_by: auth.user.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,course_id" }
    )
    .select("id, user_id, course_id, certified_date, certified_by, created_at, updated_at")
    .single();

  if (error) {
    console.error("Subcontractor certs POST error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
  return NextResponse.json({ certification: data }, { status: 201 });
}

/**
 * DELETE /api/subcontractor-certifications?user_id=X&course_id=Y
 * Removes a certification (un-certifies the subcontractor for that course).
 */
export async function DELETE(request: NextRequest) {
  const auth = await authorize();
  if (!auth.authorized)
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!isStaff(auth.user.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("user_id");
  const courseId = searchParams.get("course_id");
  if (!userId || !courseId)
    return NextResponse.json(
      { error: "user_id and course_id are required" },
      { status: 400 }
    );

  const service = createServiceClient();
  const { error } = await service
    .from("subcontractor_course_certifications")
    .delete()
    .eq("user_id", userId)
    .eq("course_id", courseId);

  if (error) {
    console.error("Subcontractor certs DELETE error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
