import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import CourseDetailClient from "./course-detail-client";
import type { CourseData, Module, Lesson } from "./course-detail-client";

// Gradient mapping by category or fallback
const GRADIENTS: Record<string, string> = {
  "data-science": "from-blue-500 to-indigo-600",
  "programming": "from-green-500 to-emerald-600",
  "cybersecurity": "from-slate-600 to-gray-800",
  "cloud": "from-sky-500 to-blue-600",
  "design": "from-pink-500 to-rose-600",
  "business": "from-amber-500 to-orange-600",
};

const DEFAULT_GRADIENT = "from-blue-500 to-indigo-600";

function getGradient(categorySlug?: string | null): string {
  if (!categorySlug) return DEFAULT_GRADIENT;
  for (const [key, value] of Object.entries(GRADIENTS)) {
    if (categorySlug.includes(key)) return value;
  }
  return DEFAULT_GRADIENT;
}

function formatCourseType(type: string | null): string {
  if (!type) return "Course";
  return type
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function formatDifficulty(level: string | null): string {
  if (!level) return "Beginner";
  return level.charAt(0).toUpperCase() + level.slice(1);
}

function mapContentType(type: string | null): "video" | "document" | "html" | "quiz" {
  switch (type) {
    case "video":
      return "video";
    case "document":
    case "pdf":
      return "document";
    case "quiz":
    case "assessment":
      return "quiz";
    case "html":
    case "interactive":
      return "html";
    default:
      return "document";
  }
}

function getInitials(firstName: string | null, lastName: string | null): string {
  const f = firstName?.charAt(0)?.toUpperCase() || "";
  const l = lastName?.charAt(0)?.toUpperCase() || "";
  return f + l || "IN";
}

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  // Auth check
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Look up internal user
  const service = createServiceClient();
  const { data: dbUser } = await service
    .from("users")
    .select("id, first_name, last_name")
    .eq("auth_id", user.id)
    .single();

  if (!dbUser) {
    redirect("/login");
  }

  // Fetch course with category
  const { data: courseRow, error: courseError } = await service
    .from("courses")
    .select("*, categories(id, name, slug)")
    .eq("slug", slug)
    .single();

  if (courseError || !courseRow) {
    notFound();
  }

  const course = courseRow as any;

  // Fetch instructor info
  const { data: instructorRow } = await service
    .from("users")
    .select("id, first_name, last_name, bio")
    .eq("id", course.created_by)
    .single();

  const instructor = instructorRow as any;

  // Fetch modules with lessons
  const { data: modulesData } = await service
    .from("modules")
    .select("id, title, description, sequence_order, lessons(id, title, content_type, duration, sequence_order, is_required)")
    .eq("course_id", course.id)
    .order("sequence_order", { ascending: true });

  const modules = ((modulesData || []) as any[]).map((mod: any) => {
    const sortedLessons = (mod.lessons || []).sort(
      (a: any, b: any) => (a.sequence_order || 0) - (b.sequence_order || 0)
    );
    return {
      id: mod.id,
      title: mod.title,
      lessons: sortedLessons.map((lesson: any) => ({
        id: lesson.id,
        title: lesson.title,
        type: mapContentType(lesson.content_type),
        duration: lesson.duration || 0,
        completed: false, // Will be updated below if enrolled
      })),
    } as Module;
  });

  // Check enrollment
  const { data: enrollmentRow } = await service
    .from("enrollments")
    .select("id, status")
    .eq("user_id", dbUser.id)
    .eq("course_id", course.id)
    .maybeSingle();

  const isEnrolled = !!enrollmentRow && enrollmentRow.status !== "dropped";

  // Check if the user has a pending approval request for this course
  let hasPendingApproval = false;
  if (!isEnrolled && course.enrollment_type === "approval") {
    const { data: pendingApproval } = await service
      .from("enrollment_approvals")
      .select("id")
      .eq("learner_id", dbUser.id)
      .eq("course_id", course.id)
      .eq("status", "pending")
      .maybeSingle();
    hasPendingApproval = !!pendingApproval;
  }

  // If enrolled, check lesson progress
  if (isEnrolled) {
    const allLessonIds = modules.flatMap((m) => m.lessons.map((l) => l.id));
    if (allLessonIds.length > 0) {
      const { data: progressData } = await service
        .from("lesson_progress")
        .select("lesson_id, status")
        .eq("user_id", dbUser.id)
        .in("lesson_id", allLessonIds);

      if (progressData) {
        const completedSet = new Set(
          (progressData as any[])
            .filter((p: any) => p.status === "completed")
            .map((p: any) => p.lesson_id)
        );
        for (const mod of modules) {
          for (const lesson of mod.lessons) {
            lesson.completed = completedSet.has(lesson.id);
          }
        }
      }
    }
  }

  // Fetch prerequisites for this course
  const { data: prerequisitesData } = await service
    .from("course_prerequisites")
    .select(
      "id, requirement_type, min_score, prerequisite_course:courses!course_prerequisites_prerequisite_course_id_fkey(id, title, slug, difficulty_level)"
    )
    .eq("course_id", course.id)
    .order("created_at", { ascending: true });

  // Check which prerequisites the user has met
  const prerequisites: {
    id: string;
    title: string;
    slug: string;
    requirement_type: string;
    min_score: number | null;
    met: boolean;
  }[] = [];

  if (prerequisitesData && prerequisitesData.length > 0) {
    for (const prereq of prerequisitesData) {
      const prereqCourse = prereq.prerequisite_course as any;
      const prereqCourseId = prereqCourse?.id;

      let met = false;

      if (prereqCourseId) {
        const { data: prereqEnrollment } = await service
          .from("enrollments")
          .select("id, status, score")
          .eq("user_id", dbUser.id)
          .eq("course_id", prereqCourseId)
          .maybeSingle();

        if (prereq.requirement_type === "enrollment") {
          met = !!prereqEnrollment && prereqEnrollment.status !== "dropped";
        } else if (prereq.requirement_type === "completion") {
          met = !!prereqEnrollment && prereqEnrollment.status === "completed";
        } else if (prereq.requirement_type === "min_score") {
          met =
            !!prereqEnrollment &&
            prereqEnrollment.status === "completed" &&
            (prereqEnrollment.score ?? 0) >= (prereq.min_score ?? 0);
        }
      }

      prerequisites.push({
        id: prereq.id,
        title: prereqCourse?.title || "Unknown Course",
        slug: prereqCourse?.slug || "",
        requirement_type: prereq.requirement_type,
        min_score: prereq.min_score,
        met,
      });
    }
  }

  const allPrerequisitesMet =
    prerequisites.length === 0 || prerequisites.every((p) => p.met);

  // Count enrollments for this course
  const { count: enrolledCount } = await service
    .from("enrollments")
    .select("id", { count: "exact", head: true })
    .eq("course_id", course.id)
    .neq("status", "dropped");

  // Fetch related courses (same category, excluding current)
  const { data: relatedRows } = await service
    .from("courses")
    .select("slug, title, created_by, estimated_duration, metadata, categories(slug)")
    .eq("category_id", course.category_id)
    .neq("id", course.id)
    .eq("status", "published")
    .limit(3);

  // Get instructor names for related courses
  const relatedCourses = [];
  for (const rc of (relatedRows || []) as any[]) {
    const { data: rcInstructor } = await service
      .from("users")
      .select("first_name, last_name")
      .eq("id", rc.created_by)
      .single();

    const rcCatSlug = rc.categories?.slug || null;
    relatedCourses.push({
      slug: rc.slug,
      title: rc.title,
      instructor: rcInstructor
        ? `${rcInstructor.first_name || ""} ${rcInstructor.last_name || ""}`.trim()
        : "Instructor",
      gradient: getGradient(rcCatSlug),
      rating: rc.metadata?.rating || 0,
      duration: rc.estimated_duration || 0,
    });
  }

  // Extract metadata fields
  const metadata = course.metadata || {};
  const categorySlug = course.categories?.slug || null;

  // Build skills and learning outcomes from metadata/tags
  const skills: string[] = metadata.skills || course.tags || [];
  const learningOutcomes: string[] = metadata.learning_outcomes || metadata.learningOutcomes || [];

  const courseData: CourseData = {
    id: course.id,
    slug: course.slug,
    title: course.title,
    shortDescription: course.short_description || course.description || "",
    fullDescription: course.description || course.short_description || "",
    instructor: {
      name: instructor
        ? `${instructor.first_name || ""} ${instructor.last_name || ""}`.trim()
        : "Instructor",
      avatar: instructor
        ? getInitials(instructor.first_name, instructor.last_name)
        : "IN",
      bio: instructor?.bio || "",
    },
    difficulty: formatDifficulty(course.difficulty_level),
    type: formatCourseType(course.course_type),
    duration: course.estimated_duration || 0,
    rating: metadata.rating || 0,
    reviewCount: metadata.review_count || metadata.reviewCount || 0,
    enrolledCount: enrolledCount || 0,
    language: metadata.language || "English",
    hasCertificate: metadata.has_certificate ?? true,
    gradient: getGradient(categorySlug),
    skills,
    learningOutcomes,
    modules,
    reviews: metadata.reviews || [],
    relatedCourses,
  };

  return (
    <CourseDetailClient
      course={courseData}
      initialEnrolled={isEnrolled}
      prerequisites={prerequisites}
      allPrerequisitesMet={allPrerequisitesMet}
      requiresApproval={course.enrollment_type === "approval"}
      hasPendingApproval={hasPendingApproval}
    />
  );
}
