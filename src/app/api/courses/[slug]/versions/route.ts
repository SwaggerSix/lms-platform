import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/auth/authorize";
import { createServiceClient } from "@/lib/supabase/service";
import { logAudit } from "@/lib/audit";
import { snapshotCourseVersion } from "@/lib/courses/versioning";

type Ctx = { params: Promise<{ slug: string }> };

async function resolveCourse(
  service: ReturnType<typeof createServiceClient>,
  slug: string
) {
  const { data } = await service
    .from("courses")
    .select("id, created_by, status")
    .eq("slug", slug)
    .maybeSingle();
  return data as { id: string; created_by: string | null; status: string } | null;
}

function summarize(row: any) {
  const modules = Array.isArray(row.snapshot?.modules) ? row.snapshot.modules : [];
  const lessonCount = modules.reduce(
    (sum: number, m: any) => sum + (Array.isArray(m.lessons) ? m.lessons.length : 0),
    0
  );
  const creator = row.creator;
  return {
    id: row.id,
    version_number: row.version_number,
    is_current: row.is_current,
    published_at: row.published_at,
    published_by: creator ? `${creator.first_name ?? ""} ${creator.last_name ?? ""}`.trim() : null,
    module_count: modules.length,
    lesson_count: lessonCount,
  };
}

export async function GET(_request: NextRequest, { params }: Ctx) {
  const auth = await authorize("admin", "instructor");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const service = createServiceClient();
  const { slug } = await params;
  const course = await resolveCourse(service, slug);
  if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404 });
  if (auth.user.role === "instructor" && course.created_by !== auth.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await service
    .from("course_versions")
    .select("id, version_number, is_current, published_at, snapshot, creator:users!course_versions_published_by_fkey(first_name, last_name)")
    .eq("course_id", course.id)
    .order("version_number", { ascending: false });

  if (error) {
    console.error("Course versions GET error:", error.message);
    return NextResponse.json({ error: "An internal error occurred" }, { status: 500 });
  }

  return NextResponse.json({ versions: (data ?? []).map(summarize) });
}

/**
 * POST — capture the course's current content as a new current version.
 * This is the "publish new version" / republish-after-edits action; unlike the
 * automatic snapshot on the draft→published transition, it works on an
 * already-published course so edits become a new, immutable version.
 */
export async function POST(_request: NextRequest, { params }: Ctx) {
  const auth = await authorize("admin", "instructor");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const service = createServiceClient();
  const { slug } = await params;
  const course = await resolveCourse(service, slug);
  if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404 });
  if (auth.user.role === "instructor" && course.created_by !== auth.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const versionId = await snapshotCourseVersion(service, course.id, auth.user.id);
  if (!versionId) {
    return NextResponse.json({ error: "Failed to publish new version" }, { status: 500 });
  }

  logAudit({
    userId: auth.user.id,
    action: "created",
    entityType: "course_version",
    entityId: versionId,
    newValues: { course_id: course.id },
  });

  const { data } = await service
    .from("course_versions")
    .select("id, version_number, is_current, published_at, snapshot, creator:users!course_versions_published_by_fkey(first_name, last_name)")
    .eq("id", versionId)
    .single();

  return NextResponse.json({ version: data ? summarize(data) : { id: versionId } }, { status: 201 });
}
