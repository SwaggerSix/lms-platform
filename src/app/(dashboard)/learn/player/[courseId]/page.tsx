import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import PlayerClient, {
  type PlayerCourse,
  type PlayerModule,
  type PlayerLesson,
} from "./player-client";

function mapContentType(
  contentType: string | null
): "video" | "document" | "html" | "quiz" {
  const map: Record<string, "video" | "document" | "html" | "quiz"> = {
    video: "video",
    document: "document",
    html: "html",
    interactive: "html",
    quiz: "quiz",
    assessment: "quiz",
    scorm: "html",
  };
  return map[contentType ?? ""] ?? "video";
}

/**
 * Compute whether a module is available based on its drip settings.
 */
function computeModuleDripAvailability(
  mod: any,
  index: number,
  sortedModules: any[],
  enrolledAt: string | null,
  completedModuleIds: Set<string>
): { isAvailable: boolean; availableDate: string | null; dripType: string; dripMessage: string | null } {
  const dripType = mod.drip_type || "immediate";
  let isAvailable = true;
  let availableDate: string | null = null;
  let dripMessage: string | null = null;

  switch (dripType) {
    case "immediate":
      break;

    case "after_days": {
      if (!enrolledAt) {
        isAvailable = false;
        dripMessage = `Available ${mod.drip_days || 0} days after enrollment`;
        break;
      }
      const enrollDate = new Date(enrolledAt);
      const unlockDate = new Date(enrollDate);
      unlockDate.setDate(unlockDate.getDate() + (mod.drip_days || 0));
      availableDate = unlockDate.toISOString();
      isAvailable = new Date() >= unlockDate;
      if (!isAvailable) {
        dripMessage = `Available on ${unlockDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
      }
      break;
    }

    case "on_date": {
      if (mod.drip_date) {
        const targetDate = new Date(mod.drip_date);
        availableDate = targetDate.toISOString();
        isAvailable = new Date() >= targetDate;
        if (!isAvailable) {
          dripMessage = `Available on ${targetDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
        }
      }
      break;
    }

    case "after_previous": {
      if (index === 0) {
        isAvailable = true;
      } else {
        const prevModule = sortedModules[index - 1];
        isAvailable = completedModuleIds.has(prevModule.id);
        if (!isAvailable) {
          dripMessage = "Complete previous module first";
        }
      }
      break;
    }
  }

  return { isAvailable, availableDate, dripType, dripMessage };
}

export default async function CoursePlayerPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const supabase = await createClient();

  // Auth check
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Look up internal user by auth_id
  const service = createServiceClient();
  const { data: dbUser } = await service
    .from("users")
    .select("id")
    .eq("auth_id", user.id)
    .single();

  if (!dbUser) {
    redirect("/login");
  }

  // Fetch the course with modules and lessons (include drip fields)
  const { data: course } = await service
    .from("courses")
    .select(
      "id, title, slug, description, course_type, estimated_duration, modules(id, title, description, sequence_order, drip_type, drip_days, drip_date, lessons(id, title, content_type, content_url, content_data, duration, sequence_order, is_required))"
    )
    .eq("id", courseId)
    .single();

  if (!course) {
    redirect("/learn/my-courses");
  }

  // Fetch the user's enrollment for this course
  const { data: enrollment } = await service
    .from("enrollments")
    .select("id, status, time_spent, enrolled_at")
    .eq("user_id", dbUser.id)
    .eq("course_id", courseId)
    .single();

  // Gather all lesson IDs for progress lookup
  const courseData = course as any;
  const allLessonIds: string[] = (courseData.modules ?? []).flatMap(
    (m: any) => (m.lessons ?? []).map((l: any) => l.id)
  );

  // Fetch lesson progress for all lessons in this course
  let progressMap: Record<string, string> = {};
  if (enrollment && allLessonIds.length > 0) {
    const { data: progressRows } = await service
      .from("lesson_progress")
      .select("lesson_id, status")
      .eq("user_id", dbUser.id)
      .eq("enrollment_id", enrollment.id)
      .in("lesson_id", allLessonIds);

    for (const row of progressRows ?? []) {
      progressMap[row.lesson_id] = row.status;
    }
  }

  // Build the sorted modules and lessons structure
  const sortedModules = [...(courseData.modules ?? [])].sort(
    (a: any, b: any) => (a.sequence_order ?? 0) - (b.sequence_order ?? 0)
  );

  // Determine completed modules for drip logic
  const completedModuleIds = new Set<string>();
  for (const mod of sortedModules) {
    const moduleLessons = (mod.lessons ?? []) as any[];
    if (
      moduleLessons.length > 0 &&
      moduleLessons.every((l: any) => progressMap[l.id] === "completed")
    ) {
      completedModuleIds.add(mod.id);
    }
  }

  const enrolledAt = enrollment?.enrolled_at ?? null;

  // Determine the "current" lesson: first non-completed lesson, or first lesson
  let currentLessonId: string | null = null;

  const playerModules: PlayerModule[] = sortedModules.map((mod: any, modIndex: number) => {
    const sortedLessons = [...(mod.lessons ?? [])].sort(
      (a: any, b: any) => (a.sequence_order ?? 0) - (b.sequence_order ?? 0)
    );

    // Compute drip availability for this module
    const drip = computeModuleDripAvailability(
      mod,
      modIndex,
      sortedModules,
      enrolledAt,
      completedModuleIds
    );

    const lessons: PlayerLesson[] = sortedLessons.map((lesson: any) => {
      const progressStatus = progressMap[lesson.id];
      let status: "completed" | "current" | "locked" = "locked";

      if (progressStatus === "completed") {
        status = "completed";
      } else if (
        progressStatus === "in_progress" ||
        progressStatus === "started"
      ) {
        if (!currentLessonId) {
          currentLessonId = lesson.id;
        }
        status = currentLessonId === lesson.id ? "current" : "locked";
      }

      // If the module is drip-locked, force all lessons to locked
      if (!drip.isAvailable && status !== "completed") {
        status = "locked";
      }

      // Extract content from content_data if available
      let content: string | undefined;
      if (lesson.content_data) {
        try {
          const parsed =
            typeof lesson.content_data === "string"
              ? JSON.parse(lesson.content_data)
              : lesson.content_data;
          content = parsed.html || parsed.content || parsed.text || parsed.description || parsed.transcript || parsed.instructions;
        } catch {
          // ignore parse errors
        }
      }

      return {
        id: lesson.id,
        title: lesson.title,
        type: mapContentType(lesson.content_type),
        duration: lesson.duration ?? 0,
        status,
        content,
        contentTypeRaw: lesson.content_type ?? undefined,
        contentUrl: lesson.content_url ?? null,
        contentData: lesson.content_data ?? null,
      };
    });

    return {
      id: mod.id,
      title: mod.title,
      lessons,
      isAvailable: drip.isAvailable,
      availableDate: drip.availableDate,
      dripType: drip.dripType,
      dripMessage: drip.dripMessage,
    };
  });

  // If no lesson is marked as current yet, find first non-completed in an available module
  if (!currentLessonId) {
    for (const mod of playerModules) {
      if (!mod.isAvailable) continue;
      for (const lesson of mod.lessons) {
        if (lesson.status !== "completed") {
          currentLessonId = lesson.id;
          lesson.status = "current";
          break;
        }
      }
      if (currentLessonId) break;
    }
  }

  // If still no current lesson, try any module (even locked ones may have completed lessons)
  if (!currentLessonId) {
    for (const mod of playerModules) {
      for (const lesson of mod.lessons) {
        if (lesson.status !== "completed") {
          currentLessonId = lesson.id;
          lesson.status = "current";
          break;
        }
      }
      if (currentLessonId) break;
    }
  }

  // If still no current lesson (all completed or empty), default to first lesson
  if (!currentLessonId) {
    const firstLesson = playerModules[0]?.lessons[0];
    if (firstLesson) {
      currentLessonId = firstLesson.id;
      firstLesson.status = "current";
    }
  }

  // Mark the identified current lesson
  for (const mod of playerModules) {
    for (const lesson of mod.lessons) {
      if (lesson.id === currentLessonId && lesson.status === "locked") {
        lesson.status = "current";
      }
    }
  }

  const playerCourse: PlayerCourse = {
    id: courseData.id,
    title: courseData.title,
    modules: playerModules,
  };

  return (
    <PlayerClient
      course={playerCourse}
      initialLessonId={currentLessonId ?? playerModules[0]?.lessons[0]?.id ?? ""}
      enrollmentId={enrollment?.id ?? null}
    />
  );
}
