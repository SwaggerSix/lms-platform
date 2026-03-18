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

  // Fetch the course with modules and lessons
  const { data: course } = await service
    .from("courses")
    .select(
      "id, title, slug, description, course_type, estimated_duration, modules(id, title, description, sequence_order, lessons(id, title, content_type, content_url, content_data, duration, sequence_order, is_required))"
    )
    .eq("id", courseId)
    .single();

  if (!course) {
    redirect("/learn/my-courses");
  }

  // Fetch the user's enrollment for this course
  const { data: enrollment } = await service
    .from("enrollments")
    .select("id, status, time_spent")
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

  // Determine the "current" lesson: first non-completed lesson, or first lesson
  let currentLessonId: string | null = null;

  const playerModules: PlayerModule[] = sortedModules.map((mod: any) => {
    const sortedLessons = [...(mod.lessons ?? [])].sort(
      (a: any, b: any) => (a.sequence_order ?? 0) - (b.sequence_order ?? 0)
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

      // Extract content from content_data if available
      let content: string | undefined;
      if (lesson.content_data) {
        try {
          const parsed =
            typeof lesson.content_data === "string"
              ? JSON.parse(lesson.content_data)
              : lesson.content_data;
          content = parsed.description || parsed.content || parsed.text;
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
    };
  });

  // If no lesson is marked as current yet, find first non-completed
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
