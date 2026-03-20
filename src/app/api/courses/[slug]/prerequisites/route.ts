import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { authorize } from "@/lib/auth/authorize";
import { validateBody } from "@/lib/validations";
import { z } from "zod";

const addPrerequisiteSchema = z.object({
  prerequisite_course_id: z.string().uuid(),
  requirement_type: z.enum(["completion", "min_score", "enrollment"]).default("completion"),
  min_score: z.number().int().min(0).max(100).optional().nullable(),
});

async function resolveCourseId(slug: string): Promise<string | null> {
  const service = createServiceClient();
  const { data } = await service
    .from("courses")
    .select("id")
    .eq("slug", slug)
    .single();
  return data?.id ?? null;
}

// Check for circular dependencies: would adding prerequisite_course_id as a
// prerequisite of course_id create a cycle?
async function wouldCreateCycle(
  courseId: string,
  prerequisiteCourseId: string
): Promise<boolean> {
  const service = createServiceClient();

  // BFS: starting from prerequisiteCourseId, see if we can reach courseId
  // through existing prerequisite chains
  const visited = new Set<string>();
  const queue = [prerequisiteCourseId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === courseId) return true;
    if (visited.has(current)) continue;
    visited.add(current);

    const { data: prereqs } = await service
      .from("course_prerequisites")
      .select("prerequisite_course_id")
      .eq("course_id", current);

    if (prereqs) {
      for (const p of prereqs) {
        if (!visited.has(p.prerequisite_course_id)) {
          queue.push(p.prerequisite_course_id);
        }
      }
    }
  }

  return false;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const service = createServiceClient();

  const courseId = await resolveCourseId(slug);
  if (!courseId) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }

  const { data, error } = await service
    .from("course_prerequisites")
    .select(
      "id, requirement_type, min_score, created_at, prerequisite_course:courses!course_prerequisites_prerequisite_course_id_fkey(id, title, slug, difficulty_level)"
    )
    .eq("course_id", courseId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Prerequisites GET error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ course_id: courseId, prerequisites: data });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const auth = await authorize("admin", "instructor");
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { slug } = await params;
  const courseId = await resolveCourseId(slug);
  if (!courseId) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const validation = validateBody(addPrerequisiteSchema, body);
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const { prerequisite_course_id, requirement_type, min_score } = validation.data;

  // Cannot add self as prerequisite (also enforced by DB constraint)
  if (prerequisite_course_id === courseId) {
    return NextResponse.json(
      { error: "A course cannot be a prerequisite of itself" },
      { status: 400 }
    );
  }

  // Verify the prerequisite course exists
  const service = createServiceClient();
  const { data: prereqCourse } = await service
    .from("courses")
    .select("id")
    .eq("id", prerequisite_course_id)
    .single();

  if (!prereqCourse) {
    return NextResponse.json(
      { error: "Prerequisite course not found" },
      { status: 404 }
    );
  }

  // Validate min_score is provided when requirement_type is min_score
  if (requirement_type === "min_score" && (min_score == null || min_score < 0)) {
    return NextResponse.json(
      { error: "min_score is required and must be >= 0 when requirement_type is 'min_score'" },
      { status: 400 }
    );
  }

  // Check for circular dependencies
  const hasCycle = await wouldCreateCycle(courseId, prerequisite_course_id);
  if (hasCycle) {
    return NextResponse.json(
      { error: "Adding this prerequisite would create a circular dependency" },
      { status: 400 }
    );
  }

  const { data, error } = await service
    .from("course_prerequisites")
    .insert({
      course_id: courseId,
      prerequisite_course_id,
      requirement_type,
      min_score: requirement_type === "min_score" ? min_score : null,
    })
    .select(
      "id, requirement_type, min_score, created_at, prerequisite_course:courses!course_prerequisites_prerequisite_course_id_fkey(id, title, slug, difficulty_level)"
    )
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "This prerequisite already exists for the course" },
        { status: 409 }
      );
    }
    console.error("Prerequisites POST error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const auth = await authorize("admin", "instructor");
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { slug } = await params;
  const courseId = await resolveCourseId(slug);
  if (!courseId) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const prerequisiteId = searchParams.get("prerequisite_id");

  if (!prerequisiteId) {
    return NextResponse.json(
      { error: "prerequisite_id query parameter is required" },
      { status: 400 }
    );
  }

  const service = createServiceClient();

  // Verify the prerequisite belongs to this course
  const { data: existing } = await service
    .from("course_prerequisites")
    .select("id")
    .eq("id", prerequisiteId)
    .eq("course_id", courseId)
    .single();

  if (!existing) {
    return NextResponse.json(
      { error: "Prerequisite not found for this course" },
      { status: 404 }
    );
  }

  const { error } = await service
    .from("course_prerequisites")
    .delete()
    .eq("id", prerequisiteId);

  if (error) {
    console.error("Prerequisites DELETE error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ message: "Prerequisite removed" });
}
