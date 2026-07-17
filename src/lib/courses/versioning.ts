import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Course versioning (L2 audit finding).
 *
 * A version is an immutable snapshot of a course's structure and content taken
 * at publish time. Enrollments pin the version they are taking so edits to a
 * live course never change what an in-progress learner sees, and completion
 * records point at the exact version that was finished.
 */

export interface CourseSnapshot {
  course: {
    title: string;
    description: string | null;
    short_description: string | null;
    passing_score: number | null;
  };
  modules: Array<{
    id: string;
    title: string;
    description: string | null;
    sequence_order: number;
    lessons: Array<{
      id: string;
      title: string;
      content_type: string;
      content_url: string | null;
      content_data: unknown;
      duration: number | null;
      sequence_order: number;
      is_required: boolean;
      content_blocks: Array<{
        id: string;
        block_type: string;
        content: unknown;
        sequence_order: number;
      }>;
    }>;
  }>;
}

/** Read the course's current structure/content into an immutable snapshot. */
export async function buildCourseSnapshot(
  service: SupabaseClient,
  courseId: string
): Promise<CourseSnapshot> {
  const { data: course } = await service
    .from("courses")
    .select("title, description, short_description, passing_score")
    .eq("id", courseId)
    .single();

  const { data: modules } = await service
    .from("modules")
    .select("id, title, description, sequence_order")
    .eq("course_id", courseId)
    .order("sequence_order", { ascending: true });

  const moduleIds = (modules ?? []).map((m: any) => m.id);
  const { data: lessons } = moduleIds.length
    ? await service
        .from("lessons")
        .select("id, module_id, title, content_type, content_url, content_data, duration, sequence_order, is_required")
        .in("module_id", moduleIds)
        .order("sequence_order", { ascending: true })
    : { data: [] as any[] };

  const lessonIds = (lessons ?? []).map((l: any) => l.id);
  const { data: blocks } = lessonIds.length
    ? await service
        .from("content_blocks")
        .select("id, lesson_id, block_type, content, sequence_order")
        .in("lesson_id", lessonIds)
        .order("sequence_order", { ascending: true })
    : { data: [] as any[] };

  const blocksByLesson = new Map<string, any[]>();
  for (const b of blocks ?? []) {
    const arr = blocksByLesson.get(b.lesson_id) ?? [];
    arr.push({ id: b.id, block_type: b.block_type, content: b.content, sequence_order: b.sequence_order });
    blocksByLesson.set(b.lesson_id, arr);
  }

  const lessonsByModule = new Map<string, any[]>();
  for (const l of lessons ?? []) {
    const arr = lessonsByModule.get(l.module_id) ?? [];
    arr.push({
      id: l.id, title: l.title, content_type: l.content_type, content_url: l.content_url,
      content_data: l.content_data, duration: l.duration, sequence_order: l.sequence_order,
      is_required: l.is_required, content_blocks: blocksByLesson.get(l.id) ?? [],
    });
    lessonsByModule.set(l.module_id, arr);
  }

  return {
    course: {
      title: course?.title ?? "",
      description: course?.description ?? null,
      short_description: course?.short_description ?? null,
      passing_score: course?.passing_score ?? null,
    },
    modules: (modules ?? []).map((m: any) => ({
      id: m.id, title: m.title, description: m.description, sequence_order: m.sequence_order,
      lessons: lessonsByModule.get(m.id) ?? [],
    })),
  };
}

/**
 * Capture a new immutable version of the course and make it current. Called
 * when a course transitions to published. Returns the new version's id, or
 * null on failure (versioning must never block the publish itself).
 */
export async function snapshotCourseVersion(
  service: SupabaseClient,
  courseId: string,
  publishedBy: string | null
): Promise<string | null> {
  try {
    const snapshot = await buildCourseSnapshot(service, courseId);

    const { data: latest } = await service
      .from("course_versions")
      .select("version_number")
      .eq("course_id", courseId)
      .order("version_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextNumber = (latest?.version_number ?? 0) + 1;

    // Clear the previous current flag before inserting the new current version
    // (a partial unique index enforces one current version per course).
    await service.from("course_versions").update({ is_current: false }).eq("course_id", courseId).eq("is_current", true);

    const { data, error } = await service
      .from("course_versions")
      .insert({
        course_id: courseId,
        version_number: nextNumber,
        snapshot,
        published_by: publishedBy,
        is_current: true,
      })
      .select("id")
      .single();

    if (error) {
      console.error("snapshotCourseVersion error:", error.message);
      return null;
    }
    return data.id;
  } catch (err) {
    console.error("snapshotCourseVersion failed:", err);
    return null;
  }
}

/**
 * Load the module/lesson structure captured in a specific version's snapshot.
 * Used by the learner-facing reads (player, completion math) so an in-progress
 * learner sees the exact version they are pinned to rather than the live course,
 * which may have been edited since. Returns null if the version is missing or
 * its snapshot is malformed (callers fall back to the live course tables).
 */
export async function getVersionSnapshotStructure(
  service: SupabaseClient,
  versionId: string
): Promise<{ versionNumber: number; modules: CourseSnapshot["modules"] } | null> {
  const { data } = await service
    .from("course_versions")
    .select("version_number, snapshot")
    .eq("id", versionId)
    .maybeSingle();

  if (!data) return null;
  const snapshot = data.snapshot as CourseSnapshot | null;
  const modules = Array.isArray(snapshot?.modules) ? snapshot!.modules : null;
  if (!modules) return null;

  return { versionNumber: data.version_number as number, modules };
}

/** The current (published) version id for a course, or null if unversioned. */
export async function getCurrentCourseVersionId(
  service: SupabaseClient,
  courseId: string
): Promise<string | null> {
  const { data } = await service
    .from("course_versions")
    .select("id")
    .eq("course_id", courseId)
    .eq("is_current", true)
    .maybeSingle();
  return data?.id ?? null;
}
