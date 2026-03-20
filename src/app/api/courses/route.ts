import { createClient } from "@/lib/supabase/server";
import { authorize } from "@/lib/auth/authorize";
import { NextRequest, NextResponse } from "next/server";
import { dispatchWebhook } from "@/lib/webhooks/dispatcher";
import { validateBody, createCourseSchema, updateCourseSchema } from "@/lib/validations";
import { createServiceClient } from "@/lib/supabase/service";
import { logAudit } from "@/lib/audit";
import { getTenantScope } from "@/lib/tenants/tenant-queries";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const service = createServiceClient();
  const { data: profile } = await service.from("users").select("id, role").eq("auth_id", user.id).single();
  const { searchParams } = new URL(request.url);

  const status = searchParams.get("status") || "published";
  const category = searchParams.get("category");
  const search = searchParams.get("search");
  const difficulty = searchParams.get("difficulty");
  const type = searchParams.get("type");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "12");
  const offset = (page - 1) * limit;

  // Resolve tenant scope
  const tenantScope = profile ? await getTenantScope(profile.id, profile.role, request) : null;

  let query = service
    .from("courses")
    .select("*, category:categories(*)", { count: "exact" })
    .eq("status", status)
    .order("published_at", { ascending: false })
    .range(offset, offset + limit - 1);

  // Apply tenant filtering
  if (tenantScope && tenantScope.courseIds.length > 0) {
    query = query.in("id", tenantScope.courseIds);
  } else if (tenantScope && tenantScope.courseIds.length === 0) {
    // Tenant has no courses assigned — return empty
    return NextResponse.json({ courses: [], total: 0, page, totalPages: 0 });
  }

  if (category) query = query.eq("category_id", category);
  if (difficulty) query = query.eq("difficulty_level", difficulty);
  if (type) query = query.eq("course_type", type);
  if (search) {
    const sanitizedSearch = search.replace(/[%_\\'"()]/g, "");
    query = query.ilike("title", `%${sanitizedSearch}%`);
  }

  const { data, count, error } = await query;

  if (error) {
    console.error("Courses API error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({
    courses: data,
    total: count,
    page,
    totalPages: Math.ceil((count || 0) / limit),
  });
}

export async function POST(request: NextRequest) {
  const auth = await authorize("admin", "instructor");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabase = await createClient();
  const service = createServiceClient();
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const validation = validateBody(createCourseSchema, body);
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  // Auto-generate slug from title if not provided
  const courseData = { ...validation.data };
  if (!courseData.slug && courseData.title) {
    courseData.slug = courseData.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      + "-" + Date.now().toString(36);
  }

  // Extract modules from metadata before inserting the course
  const inlineModules = (courseData.metadata as any)?.modules as any[] | undefined;

  const { data, error } = await service
    .from("courses")
    .insert({ ...courseData, created_by: auth.user.id })
    .select()
    .single();

  if (error) {
    console.error("Courses API error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  // Create modules (with drip settings) and lessons if provided inline via metadata
  if (inlineModules && Array.isArray(inlineModules) && inlineModules.length > 0) {
    for (const mod of inlineModules) {
      const { data: createdModule } = await service
        .from("modules")
        .insert({
          course_id: data.id,
          title: mod.title || "Untitled Module",
          description: mod.description || null,
          sequence_order: mod.sequence_order ?? 0,
          drip_type: mod.drip_type || "immediate",
          drip_days: mod.drip_days || 0,
          drip_date: mod.drip_date || null,
        })
        .select()
        .single();

      if (createdModule && mod.lessons && Array.isArray(mod.lessons)) {
        const lessonRows = mod.lessons.map((l: any, li: number) => ({
          module_id: createdModule.id,
          title: l.title || "Untitled Lesson",
          content_type: l.content_type || "video",
          duration: l.duration || 0,
          sequence_order: l.sequence_order ?? li + 1,
          is_required: l.is_required !== undefined ? l.is_required : true,
        }));

        await service.from("lessons").insert(lessonRows);
      }
    }
  }

  // Fire webhook (non-blocking)
  dispatchWebhook("course.created", {
    course_id: data.id,
    title: data.title,
  }).catch(() => {});

  logAudit({
    userId: auth.user.id,
    action: "created",
    entityType: "course",
    entityId: data.id,
    newValues: { title: data.title, slug: data.slug },
  });

  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const auth = await authorize("admin", "instructor");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabase = await createClient();
  const service = createServiceClient();

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const validation = validateBody(updateCourseSchema, body);
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }
  const { id, ...updates } = validation.data;

  // If instructor (not admin), verify they own the course
  if (auth.user.role === "instructor") {
    const { data: course } = await service
      .from("courses")
      .select("created_by")
      .eq("id", id)
      .single();

    if (!course || course.created_by !== auth.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const { data, error } = await service
    .from("courses")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Courses API error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  // Fire webhook (non-blocking)
  dispatchWebhook("course.updated", {
    course_id: id,
    updates,
  }).catch(() => {});

  logAudit({
    userId: auth.user.id,
    action: "updated",
    entityType: "course",
    entityId: id,
    newValues: updates,
  });

  return NextResponse.json(data);
}

export async function DELETE(request: NextRequest) {
  const auth = await authorize("admin", "instructor");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabase = await createClient();
  const service = createServiceClient();

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Course id is required" }, { status: 400 });
  }

  // If instructor (not admin), verify they own the course
  if (auth.user.role === "instructor") {
    const { data: course } = await service
      .from("courses")
      .select("created_by")
      .eq("id", id)
      .single();

    if (!course || course.created_by !== auth.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const { error } = await service
    .from("courses")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Courses API error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  logAudit({
    userId: auth.user.id,
    action: "deleted",
    entityType: "course",
    entityId: id,
  });

  return NextResponse.json({ message: "Course deleted" });
}
