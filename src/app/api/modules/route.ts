import { authorize } from "@/lib/auth/authorize";
import { NextRequest, NextResponse } from "next/server";
import { validateBody, updateModuleDripSchema } from "@/lib/validations";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * PATCH /api/modules - Update module drip/scheduling settings
 */
export async function PATCH(request: NextRequest) {
  const auth = await authorize("admin", "instructor");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const service = createServiceClient();

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const validation = validateBody(updateModuleDripSchema, body);
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const { id, ...updates } = validation.data;

  // Verify the module exists and the instructor owns the course
  const { data: mod } = await service
    .from("modules")
    .select("id, course_id")
    .eq("id", id)
    .single();

  if (!mod) {
    return NextResponse.json({ error: "Module not found" }, { status: 404 });
  }

  if (auth.user.role === "instructor") {
    const { data: course } = await service
      .from("courses")
      .select("created_by")
      .eq("id", mod.course_id)
      .single();

    if (!course || course.created_by !== auth.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const { data, error } = await service
    .from("modules")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Modules API error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json(data);
}
