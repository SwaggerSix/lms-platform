import { authorize } from "@/lib/auth/authorize";
import { createServiceClient } from "@/lib/supabase/service";
import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { validateBody, assignTenantCourseSchema } from "@/lib/validations";
import { checkTenantLimits } from "@/lib/tenants/tenant-context";

async function verifyTenantAdmin(userId: string, tenantId: string, platformRole: string) {
  if (platformRole === "admin") return true;
  const service = createServiceClient();
  const { data } = await service
    .from("tenant_memberships")
    .select("role")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .single();
  return data && ["owner", "admin"].includes(data.role);
}

// GET /api/tenants/[id]/courses
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await authorize();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const service = createServiceClient();

  // Verify membership
  if (auth.user.role !== "admin") {
    const { data: membership } = await service
      .from("tenant_memberships")
      .select("id")
      .eq("tenant_id", id)
      .eq("user_id", auth.user.id)
      .single();
    if (!membership) return NextResponse.json({ error: "Not a member" }, { status: 403 });
  }

  const { data, error } = await service
    .from("tenant_courses")
    .select("id, is_featured, custom_price, created_at, course:courses(id, title, slug, status, thumbnail_url, estimated_duration)")
    .eq("tenant_id", id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: "Failed to fetch courses" }, { status: 500 });

  return NextResponse.json({ courses: data });
}

// POST /api/tenants/[id]/courses - Assign a course
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await authorize();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const isAdmin = await verifyTenantAdmin(auth.user.id, id, auth.user.role);
  if (!isAdmin) return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });

  const rl = await rateLimit(`tenant-course-add-${auth.user.id}`, 30, 60000);
  if (!rl.success) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });

  const body = await request.json();
  const validation = validateBody(assignTenantCourseSchema, body);
  if (!validation.success) return NextResponse.json({ error: validation.error }, { status: 400 });

  // Check limits
  const limits = await checkTenantLimits(id, "courses");
  if (!limits.allowed) {
    return NextResponse.json(
      { error: `Course limit reached (${limits.current}/${limits.max}). Upgrade your plan.` },
      { status: 403 }
    );
  }

  const service = createServiceClient();
  const { data, error } = await service
    .from("tenant_courses")
    .insert({
      tenant_id: id,
      course_id: validation.data.course_id,
      is_featured: validation.data.is_featured ?? false,
      custom_price: validation.data.custom_price,
    })
    .select("id, is_featured, custom_price, created_at, course:courses(id, title, slug, status)")
    .single();

  if (error) {
    if (error.code === "23505") return NextResponse.json({ error: "Course already assigned" }, { status: 409 });
    if (error.code === "23503") return NextResponse.json({ error: "Course not found" }, { status: 404 });
    return NextResponse.json({ error: "Failed to assign course" }, { status: 500 });
  }

  return NextResponse.json({ course: data }, { status: 201 });
}

// DELETE /api/tenants/[id]/courses - Remove a course
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await authorize();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const isAdmin = await verifyTenantAdmin(auth.user.id, id, auth.user.role);
  if (!isAdmin) return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const courseId = searchParams.get("course_id");
  if (!courseId) return NextResponse.json({ error: "course_id is required" }, { status: 400 });

  const service = createServiceClient();
  const { error } = await service
    .from("tenant_courses")
    .delete()
    .eq("tenant_id", id)
    .eq("course_id", courseId);

  if (error) return NextResponse.json({ error: "Failed to remove course" }, { status: 500 });

  return NextResponse.json({ success: true });
}
