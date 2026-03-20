import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import PathDetailClient from "./path-detail-client";
import type { PathDetailData, PathCourse } from "./path-detail-client";
const GRADIENT_PALETTE = [
  "from-indigo-500 to-purple-600",
  "from-emerald-500 to-teal-600",
  "from-orange-500 to-red-600",
  "from-pink-500 to-rose-600",
  "from-cyan-500 to-blue-600",
  "from-amber-500 to-orange-600",
  "from-violet-500 to-purple-600",
  "from-sky-500 to-blue-600",
];

function pickGradient(index: number): string {
  return GRADIENT_PALETTE[index % GRADIENT_PALETTE.length];
}

export default async function PathDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  // Get authenticated user
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    redirect("/login");
  }

  // Fetch user profile from users table
  const service = createServiceClient();
  const { data: profile } = await service
    .from("users")
    .select("id")
    .eq("auth_id", authUser.id)
    .single();

  if (!profile) {
    redirect("/login");
  }

  // Fetch the learning path by slug with its items and courses
  const { data: rawPath } = await service
    .from("learning_paths")
    .select(
      "id, slug, title, description, estimated_duration, tags, is_sequential, created_at, learning_path_items(id, course_id, sequence_order, is_required, courses(id, title, slug, description, difficulty_level, estimated_duration))"
    )
    .eq("slug", slug)
    .eq("status", "published")
    .single();

  if (!rawPath) {
    notFound();
  }

  // Fetch user's enrollment for this learning path
  const { data: enrollment } = await service
    .from("learning_path_enrollments")
    .select("id, status, enrolled_at, completed_at")
    .eq("user_id", profile.id)
    .eq("path_id", rawPath.id)
    .single();

  const isEnrolled = !!enrollment;

  // Get the path items sorted by sequence order
  const items = ((rawPath as any).learning_path_items as any[]) ?? [];
  items.sort((a: any, b: any) => (a.sequence_order ?? 0) - (b.sequence_order ?? 0));

  // Gather course IDs from path items
  const courseIds = items
    .map((item: any) => item.course_id)
    .filter(Boolean);

  // Fetch user's course enrollments to determine per-course status and progress
  let courseEnrollmentMap = new Map<string, { status: string; time_spent: number; score: number | null }>();
  if (courseIds.length > 0) {
    const { data: courseEnrollments } = await service
      .from("enrollments")
      .select("course_id, status, time_spent, score")
      .eq("user_id", profile.id)
      .in("course_id", courseIds);

    if (courseEnrollments) {
      for (const ce of courseEnrollments) {
        courseEnrollmentMap.set(ce.course_id, {
          status: ce.status,
          time_spent: ce.time_spent ?? 0,
          score: ce.score,
        });
      }
    }
  }

  // Count total enrollments for this path (for display)
  const { count: enrolledCount } = await service
    .from("learning_path_enrollments")
    .select("id", { count: "exact", head: true })
    .eq("path_id", rawPath.id);

  // Determine a gradient based on the slug hash (consistent assignment)
  const slugHash = slug.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const gradient = pickGradient(slugHash);

  // Capitalize difficulty level for display
  function capitalizeDifficulty(level: string): "Beginner" | "Intermediate" | "Advanced" {
    const map: Record<string, "Beginner" | "Intermediate" | "Advanced"> = {
      beginner: "Beginner",
      intermediate: "Intermediate",
      advanced: "Advanced",
    };
    return map[level] ?? "Beginner";
  }

  // Build course list with status info
  const isSequential = rawPath.is_sequential ?? false;
  let firstIncompleteSeen = false;

  const courses: PathCourse[] = items.map((item: any, index: number) => {
    const course = item.courses as any;
    const courseEnrollment = courseEnrollmentMap.get(item.course_id);

    // Determine status
    let status: "completed" | "in_progress" | "locked";
    let progress: number | undefined;

    if (courseEnrollment?.status === "completed") {
      status = "completed";
      progress = 100;
    } else if (courseEnrollment?.status === "in_progress") {
      status = "in_progress";
      // Estimate progress from time_spent vs estimated_duration
      const estDuration = course?.estimated_duration ?? 0;
      if (estDuration > 0) {
        progress = Math.min(95, Math.round((courseEnrollment.time_spent / estDuration) * 100));
      } else {
        progress = 50;
      }
      firstIncompleteSeen = true;
    } else if (!isEnrolled) {
      // Not enrolled in path at all - show all as locked
      status = "locked";
    } else if (isSequential && firstIncompleteSeen) {
      status = "locked";
    } else if (isSequential && !firstIncompleteSeen) {
      // First incomplete course in sequential path is in_progress (or at least unlocked)
      status = "in_progress";
      progress = 0;
      firstIncompleteSeen = true;
    } else {
      // Non-sequential: enrolled courses that haven't started yet
      status = "locked";
    }

    return {
      id: course?.id ?? item.course_id,
      sequence: item.sequence_order ?? index + 1,
      title: course?.title ?? "Untitled Course",
      description: course?.description ?? "",
      duration: course?.estimated_duration ?? 0,
      difficulty: capitalizeDifficulty(course?.difficulty_level ?? "beginner"),
      status,
      progress,
    };
  });

  // Calculate overall progress
  const completedCount = courses.filter((c) => c.status === "completed").length;
  const overallProgress = courses.length > 0
    ? Math.round((completedCount / courses.length) * 100)
    : 0;

  // Calculate total duration from actual courses
  const totalDuration = rawPath.estimated_duration ?? courses.reduce((sum, c) => sum + c.duration, 0);

  // Estimate completion date (rough: remaining minutes / 60 min per day -> days from now)
  const remainingDuration = courses
    .filter((c) => c.status !== "completed")
    .reduce((sum, c) => sum + c.duration, 0);
  const daysRemaining = Math.ceil(remainingDuration / 60);
  const estimatedCompletion = new Date();
  estimatedCompletion.setDate(estimatedCompletion.getDate() + daysRemaining);

  const pathData: PathDetailData = {
    id: rawPath.id,
    slug: rawPath.slug,
    title: rawPath.title,
    description: rawPath.description ?? "",
    courseCount: courses.length,
    totalDuration,
    enrolledCount: enrolledCount ?? 0,
    estimatedCompletion: estimatedCompletion.toISOString().split("T")[0],
    overallProgress,
    gradient,
    skills: rawPath.tags ?? [],
    courses,
  };

  return <PathDetailClient path={pathData} initialEnrolled={isEnrolled} />;
}
