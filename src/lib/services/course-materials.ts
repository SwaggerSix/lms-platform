import { createServiceClient } from "@/lib/supabase/service";

type ServiceClient = ReturnType<typeof createServiceClient>;

/**
 * Copy a course's downloadable learner materials into a user's personal
 * Documents (rows owned by the user, tagged with the course). Idempotent —
 * safe to call again on re-enrollment — and best-effort: it never throws, so a
 * provisioning hiccup can't break the enrollment it hangs off of.
 *
 * "Materials" = lessons that have a content_url (excluding quizzes). They
 * persist in the user's Documents tab even after the course/license ends.
 */
export async function provisionCourseMaterials(
  service: ServiceClient,
  userId: string,
  courseId: string
): Promise<void> {
  try {
    const { data: course } = await service
      .from("courses")
      .select("id, title")
      .eq("id", courseId)
      .single();
    if (!course) return;

    const { data: modules } = await service
      .from("modules")
      .select("id")
      .eq("course_id", courseId);
    const moduleIds = (modules ?? []).map((m: any) => m.id);
    if (moduleIds.length === 0) return;

    const { data: lessons } = await service
      .from("lessons")
      .select("title, content_type, content_url")
      .in("module_id", moduleIds);

    // Downloadable materials = lesson content + learner-facing course
    // resources (decks, guides, etc.). Facilitator-only resources are excluded.
    const { data: resources } = await service
      .from("course_resources")
      .select("title, file_url, file_type")
      .eq("course_id", courseId)
      .eq("audience", "learner");

    const materials: { title: string; file_url: string; file_type: string }[] = [
      ...(lessons ?? [])
        .filter((l: any) => l.content_url && l.content_type !== "quiz")
        .map((l: any) => ({
          title: l.title || course.title,
          file_url: l.content_url as string,
          file_type: l.content_type ?? "document",
        })),
      ...(resources ?? []).map((r: any) => ({
        title: r.title || course.title,
        file_url: r.file_url as string,
        file_type: r.file_type ?? "document",
      })),
    ];
    if (materials.length === 0) return;

    // Owner's organization (for org scoping consistency).
    const { data: owner } = await service
      .from("users")
      .select("organization_id")
      .eq("id", userId)
      .single();

    // Skip materials already provisioned for this user+course (idempotent).
    const { data: existing } = await service
      .from("documents")
      .select("file_url")
      .eq("user_id", userId)
      .eq("course_id", courseId);
    const have = new Set((existing ?? []).map((d: any) => d.file_url));

    const seen = new Set<string>();
    const rows = materials
      .filter((m) => m.file_url && !have.has(m.file_url) && !seen.has(m.file_url) && seen.add(m.file_url))
      .map((m) => ({
        title: m.title,
        description: `Course material from "${course.title}"`,
        file_url: m.file_url,
        file_name: `${(m.title || "material").toLowerCase().replace(/\s+/g, "-")}`,
        file_type: m.file_type,
        file_size: 0,
        version: 1,
        tags: [course.title],
        organization_id: owner?.organization_id ?? null,
        visibility: "all",
        user_id: userId,
        course_id: courseId,
      }));

    if (rows.length > 0) {
      await service.from("documents").insert(rows);
    }
  } catch (err) {
    console.error("provisionCourseMaterials error:", err);
  }
}
