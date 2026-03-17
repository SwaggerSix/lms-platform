import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import MyCoursesClient from "./my-courses-client";
import type { MyCourse } from "./my-courses-client";

export const metadata: Metadata = {
  title: "My Courses | LMS Platform",
  description: "Track your enrolled courses and continue where you left off",
};

const GRADIENTS = [
  "from-blue-500 to-indigo-600",
  "from-amber-500 to-orange-600",
  "from-indigo-500 to-purple-600",
  "from-red-500 to-rose-600",
  "from-yellow-500 to-amber-600",
  "from-purple-500 to-violet-600",
];

function mapStatus(status: string): "in_progress" | "completed" {
  if (status === "completed") return "completed";
  return "in_progress";
}

function calculateProgress(
  status: string,
  timeSpent: number | null,
  estimatedDuration: number | null
): number {
  if (status === "completed") return 100;
  if (status === "enrolled") return 0;
  if (status === "in_progress") {
    if (!timeSpent || !estimatedDuration || estimatedDuration === 0) return 0;
    const raw = Math.round((timeSpent / estimatedDuration) * 100);
    return Math.min(raw, 95);
  }
  // failed, expired — treat as in_progress with same calc
  if (!timeSpent || !estimatedDuration || estimatedDuration === 0) return 0;
  const raw = Math.round((timeSpent / estimatedDuration) * 100);
  return Math.min(raw, 95);
}

export default async function MyCoursesPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: dbUser } = await supabase
    .from("users")
    .select("id")
    .eq("auth_id", user.id)
    .single();
  if (!dbUser) redirect("/login");

  const { data: enrollments, error } = await supabase
    .from("enrollments")
    .select(
      "*, course:courses(title, slug, estimated_duration, course_type)"
    )
    .eq("user_id", dbUser.id)
    .order("enrolled_at", { ascending: false })
    .limit(100);

  const courses: MyCourse[] = (enrollments ?? []).map((row: any, index: number) => {
    const course = row.course;
    return {
      id: row.id,
      slug: course?.slug ?? "",
      title: course?.title ?? "Untitled Course",
      instructor: "Instructor",
      progress: calculateProgress(
        row.status,
        row.time_spent,
        course?.estimated_duration ?? null
      ),
      status: mapStatus(row.status),
      lastAccessed: row.started_at ?? row.enrolled_at,
      dueDate: row.due_date ?? null,
      duration: course?.estimated_duration ?? 0,
      gradient: GRADIENTS[index % GRADIENTS.length],
      completedAt: row.completed_at ?? null,
    };
  });

  return <MyCoursesClient courses={courses} />;
}
