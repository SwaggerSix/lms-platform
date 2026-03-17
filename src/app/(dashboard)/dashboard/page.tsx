import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LearnerDashboardClient from "./dashboard-client";
import type { LearnerDashboardData } from "./dashboard-client";

export const metadata: Metadata = {
  title: "Dashboard | LMS Platform",
  description: "View your learning progress, upcoming deadlines, and course recommendations",
};

const GRADIENT_THUMBNAILS = [
  "bg-gradient-to-br from-blue-500 to-indigo-600",
  "bg-gradient-to-br from-red-500 to-pink-600",
  "bg-gradient-to-br from-emerald-500 to-teal-600",
  "bg-gradient-to-br from-violet-500 to-purple-600",
  "bg-gradient-to-br from-amber-500 to-orange-600",
  "bg-gradient-to-br from-cyan-500 to-blue-600",
];

const SPOTLIGHT_GRADIENTS = [
  "bg-gradient-to-br from-blue-600 to-indigo-700",
  "bg-gradient-to-br from-emerald-500 to-teal-600",
  "bg-gradient-to-br from-red-500 to-rose-600",
];

const COURSE_TYPE_LABELS: Record<string, string> = {
  self_paced: "Self-Paced",
  instructor_led: "Instructor-Led",
  blended: "Blended",
  scorm: "SCORM",
  external: "External",
};

const SPOTLIGHT_BADGES = ["Most Popular", "New", "Required"];

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0 && mins > 0) return `${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h`;
  return `${mins}m`;
}

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash);
}

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Get the user record from the users table
  const { data: dbUser } = await supabase
    .from("users")
    .select("id, first_name")
    .eq("auth_id", user.id)
    .single();

  const userName = dbUser?.first_name ?? "Learner";
  const userId = dbUser?.id;

  // Run all counts and queries in parallel
  const [
    inProgressCountResult,
    completedCountResult,
    certsCountResult,
    inProgressCoursesResult,
    deadlinesResult,
    spotlightResult,
  ] = await Promise.all([
    // Count courses in progress
    supabase
      .from("enrollments")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "in_progress"),

    // Count completed courses
    supabase
      .from("enrollments")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "completed"),

    // Count certificates earned
    supabase
      .from("user_certifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId),

    // Fetch in-progress enrollments with course data
    supabase
      .from("enrollments")
      .select(`
        id,
        time_spent,
        course:courses (
          id,
          title,
          estimated_duration,
          category:categories ( name )
        )
      `)
      .eq("user_id", userId)
      .eq("status", "in_progress")
      .limit(3),

    // Fetch upcoming deadlines
    supabase
      .from("enrollments")
      .select(`
        id,
        due_date,
        course:courses (
          title,
          course_type
        )
      `)
      .eq("user_id", userId)
      .not("due_date", "is", null)
      .gte("due_date", new Date().toISOString())
      .order("due_date", { ascending: true })
      .limit(4),

    // Fetch spotlight courses (most recent published)
    supabase
      .from("courses")
      .select(`
        id,
        title,
        description,
        estimated_duration,
        course_type,
        created_by,
        instructor:users!courses_created_by_fkey ( first_name, last_name )
      `)
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(3),
  ]);

  const coursesInProgress = inProgressCountResult.count ?? 0;
  const coursesCompleted = completedCountResult.count ?? 0;
  const certificatesEarned = certsCountResult.count ?? 0;

  // Map in-progress courses
  const inProgressCourses: LearnerDashboardData["inProgressCourses"] = (
    inProgressCoursesResult.data ?? []
  ).map((enrollment: any, index: number) => {
    const course = enrollment.course;
    const estimatedDuration = course?.estimated_duration ?? 60;
    const timeSpent = enrollment.time_spent ?? 0;
    const progress = Math.min(
      100,
      Math.round((timeSpent / estimatedDuration) * 100)
    );
    const totalLessons = Math.ceil(estimatedDuration / 30);
    const completedLessons = Math.round((progress / 100) * totalLessons);

    return {
      id: enrollment.id,
      title: course?.title ?? "Untitled Course",
      instructor: "Instructor",
      thumbnail: GRADIENT_THUMBNAILS[index % GRADIENT_THUMBNAILS.length],
      progress,
      totalLessons,
      completedLessons,
      category: course?.category?.name ?? "General",
    };
  });

  // Map upcoming deadlines
  const upcomingDeadlines: LearnerDashboardData["upcomingDeadlines"] = (
    deadlinesResult.data ?? []
  ).map((enrollment: any) => {
    const dueDate = new Date(enrollment.due_date);
    const now = new Date();
    const daysLeft = Math.ceil(
      (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );
    const courseType = enrollment.course?.course_type ?? "self_paced";

    let status: string;
    if (daysLeft <= 5) status = "urgent";
    else if (daysLeft <= 14) status = "upcoming";
    else status = "normal";

    return {
      id: enrollment.id,
      course: enrollment.course?.title ?? "Untitled Course",
      type: COURSE_TYPE_LABELS[courseType] ?? courseType,
      dueDate: dueDate.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
      daysLeft,
      status,
    };
  });

  // Map spotlight courses
  const spotlightCourses: LearnerDashboardData["spotlightCourses"] = (
    spotlightResult.data ?? []
  ).map((course: any, index: number) => {
    const hash = hashCode(course.id);
    const enrolled = 100 + (hash % 800);
    const rating = 4.5 + ((hash % 5) / 10);
    const instructor = course.instructor
      ? `${course.instructor.first_name} ${course.instructor.last_name}`
      : "Instructor";

    return {
      id: course.id,
      title: course.title ?? "Untitled Course",
      description: course.description ?? "",
      thumbnail: SPOTLIGHT_GRADIENTS[index % SPOTLIGHT_GRADIENTS.length],
      instructor,
      enrolled,
      rating: Math.round(rating * 10) / 10,
      duration: formatDuration(course.estimated_duration ?? 60),
      type: COURSE_TYPE_LABELS[course.course_type] ?? course.course_type,
      badge: SPOTLIGHT_BADGES[index] ?? "New",
    };
  });

  const dashboardData: LearnerDashboardData = {
    userName,
    coursesInProgress,
    coursesCompleted,
    certificatesEarned,
    inProgressCourses,
    upcomingDeadlines,
    spotlightCourses,
  };

  return <LearnerDashboardClient data={dashboardData} />;
}
