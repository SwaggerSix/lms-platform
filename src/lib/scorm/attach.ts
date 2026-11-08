import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ScormPackageError, type ExtractedPackage } from "./extract";

export interface Uploader {
  id: string;
  role: string;
}

export type AttachTarget =
  | { kind: "lesson"; lessonId: string }
  | { kind: "course"; courseId: string; title?: string }
  | { kind: "new-course"; title?: string };

export interface AttachResult {
  courseId: string;
  courseSlug: string;
  courseStatus: string;
  lessonId: string;
  launchUrl: string;
  createdCourse: boolean;
}

const isAdmin = (u: Uploader) => u.role === "admin" || u.role === "super_admin";

async function loadCourse(service: SupabaseClient, courseId: string) {
  const { data } = await service
    .from("courses")
    .select("id, slug, status, created_by")
    .eq("id", courseId)
    .single();
  return data as { id: string; slug: string; status: string; created_by: string | null } | null;
}

function assertCanEdit(user: Uploader, course: { created_by: string | null }) {
  // Mirrors /api/modules: instructors may only change courses they created.
  if (!isAdmin(user) && course.created_by !== user.id) {
    throw new ScormPackageError("You can only change SCORM packages on courses you created.", 403);
  }
}

function slugify(title: string) {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
  return `${base || "scorm-course"}-${Date.now().toString(36)}`;
}

function packageMeta(pkg: ExtractedPackage, fileName: string | null) {
  return {
    package_id: pkg.packageId,
    version: pkg.version,
    manifest_title: pkg.title,
    file_count: pkg.fileCount,
    total_bytes: pkg.totalBytes,
    file_name: fileName,
    uploaded_at: new Date().toISOString(),
  };
}

/**
 * Throws before any extraction work when the uploader can't edit the target,
 * so a forbidden request never writes package files.
 */
export async function assertTargetEditable(service: SupabaseClient, user: Uploader, target: AttachTarget) {
  if (target.kind === "lesson") {
    const { data: lesson } = await service
      .from("lessons")
      .select("id, module:modules!lessons_module_id_fkey(course_id)")
      .eq("id", target.lessonId)
      .single();
    const mod = (lesson as any)?.module;
    const courseId = Array.isArray(mod) ? mod[0]?.course_id : mod?.course_id;
    if (!lesson || !courseId) throw new ScormPackageError("Lesson not found.", 404);
    const course = await loadCourse(service, courseId);
    if (!course) throw new ScormPackageError("Course not found.", 404);
    assertCanEdit(user, course);
  } else if (target.kind === "course") {
    const course = await loadCourse(service, target.courseId);
    if (!course) throw new ScormPackageError("Course not found.", 404);
    assertCanEdit(user, course);
  }
}

/** Point a lesson (existing, new, or in a new course) at an extracted package. */
export async function attachPackage(
  service: SupabaseClient,
  user: Uploader,
  target: AttachTarget,
  pkg: ExtractedPackage,
  fileName: string | null
): Promise<AttachResult> {
  const meta = packageMeta(pkg, fileName);
  const fallbackTitle = (pkg.title || fileName?.replace(/\.zip$/i, "") || "SCORM course").slice(0, 200);

  if (target.kind === "lesson") {
    const { data: lesson } = await service
      .from("lessons")
      .select("id, content_data, module:modules!lessons_module_id_fkey(course_id)")
      .eq("id", target.lessonId)
      .single();
    const mod = (lesson as any)?.module;
    const courseId: string | undefined = Array.isArray(mod) ? mod[0]?.course_id : mod?.course_id;
    if (!lesson || !courseId) throw new ScormPackageError("Lesson not found.", 404);
    const course = await loadCourse(service, courseId);
    if (!course) throw new ScormPackageError("Course not found.", 404);
    assertCanEdit(user, course);

    const prev = (lesson as any).content_data;
    const contentData = { ...(prev && typeof prev === "object" && !Array.isArray(prev) ? prev : {}), scorm: meta };
    const { error } = await service
      .from("lessons")
      .update({ content_type: "scorm", content_url: pkg.launchUrl, content_data: contentData })
      .eq("id", target.lessonId);
    if (error) {
      console.error("SCORM lesson update error:", error.message);
      throw new ScormPackageError("Package stored, but the lesson could not be updated.", 500);
    }
    await service.from("courses").update({ updated_at: new Date().toISOString() }).eq("id", course.id);
    return {
      courseId: course.id,
      courseSlug: course.slug,
      courseStatus: course.status,
      lessonId: target.lessonId,
      launchUrl: pkg.launchUrl,
      createdCourse: false,
    };
  }

  let course: { id: string; slug: string; status: string; created_by: string | null } | null;
  let createdCourse = false;
  let lessonTitle = fallbackTitle;

  if (target.kind === "course") {
    course = await loadCourse(service, target.courseId);
    if (!course) throw new ScormPackageError("Course not found.", 404);
    assertCanEdit(user, course);
    if (target.title) lessonTitle = target.title.slice(0, 200);
  } else {
    const title = (target.title?.trim() || fallbackTitle).slice(0, 200);
    lessonTitle = title;
    const { data, error } = await service
      .from("courses")
      .insert({
        title,
        slug: slugify(title),
        course_type: "scorm",
        status: "draft",
        created_by: user.id,
      })
      .select("id, slug, status, created_by")
      .single();
    if (error || !data) {
      console.error("SCORM course create error:", error?.message);
      throw new ScormPackageError("Package stored, but the course could not be created.", 500);
    }
    course = data as any;
    createdCourse = true;
  }

  // Put the new lesson at the end of the last module (creating one if needed).
  const { data: modules } = await service
    .from("modules")
    .select("id, sequence_order")
    .eq("course_id", course!.id)
    .order("sequence_order", { ascending: false })
    .limit(1);
  let moduleId = modules?.[0]?.id as string | undefined;
  if (!moduleId) {
    const { data: mod, error } = await service
      .from("modules")
      .insert({ course_id: course!.id, title: lessonTitle, sequence_order: 1 })
      .select("id")
      .single();
    if (error || !mod) {
      console.error("SCORM module create error:", error?.message);
      throw new ScormPackageError("Package stored, but the course module could not be created.", 500);
    }
    moduleId = mod.id;
  }

  const { data: lastLesson } = await service
    .from("lessons")
    .select("sequence_order")
    .eq("module_id", moduleId)
    .order("sequence_order", { ascending: false })
    .limit(1);
  const nextOrder = ((lastLesson?.[0]?.sequence_order as number | undefined) ?? 0) + 1;

  const { data: lesson, error: lessonErr } = await service
    .from("lessons")
    .insert({
      module_id: moduleId,
      title: lessonTitle,
      content_type: "scorm",
      content_url: pkg.launchUrl,
      content_data: { scorm: meta },
      sequence_order: nextOrder,
      is_required: true,
    })
    .select("id")
    .single();
  if (lessonErr || !lesson) {
    console.error("SCORM lesson create error:", lessonErr?.message);
    throw new ScormPackageError("Package stored, but the lesson could not be created.", 500);
  }

  await service.from("courses").update({ updated_at: new Date().toISOString() }).eq("id", course!.id);

  return {
    courseId: course!.id,
    courseSlug: course!.slug,
    courseStatus: course!.status,
    lessonId: lesson.id,
    launchUrl: pkg.launchUrl,
    createdCourse,
  };
}
