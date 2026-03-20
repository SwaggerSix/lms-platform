import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from "@/lib/supabase/service";
import DashboardClient, { type DashboardData } from './dashboard-client';

export const metadata: Metadata = {
  title: "Admin Dashboard | LMS Platform",
  description: "Platform overview with key metrics, user activity, and course statistics",
};

export default async function AdminDashboardPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const service = createServiceClient();
  const { data: dbUser } = await service
    .from("users")
    .select("id, role")
    .eq("auth_id", user.id)
    .single();
  if (!dbUser || dbUser.role !== "admin" && dbUser.role !== "super_admin") redirect("/dashboard");

  // Date filter for "this month"
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  // Fetch aggregate stats in parallel
  const [usersResult, coursesResult, enrollmentsThisMonthResult, completedResult, totalEnrollmentsResult, topCoursesResult] = await Promise.all([
    service.from('users').select('*', { count: 'exact', head: true }),
    service.from('courses').select('*', { count: 'exact', head: true }).eq('status', 'published'),
    service.from('enrollments').select('*', { count: 'exact', head: true }).gte('enrolled_at', startOfMonth.toISOString()),
    service.from('enrollments').select('*', { count: 'exact', head: true }).eq('status', 'completed'),
    service.from('enrollments').select('*', { count: 'exact', head: true }),
    service.from('courses').select('id, title').eq('status', 'published').order('created_at', { ascending: false }).limit(5),
  ]);

  const totalUsers = usersResult.count ?? 0;
  const activeCourses = coursesResult.count ?? 0;
  const enrollmentsThisMonth = enrollmentsThisMonthResult.count ?? 0;
  const totalEnrollments = totalEnrollmentsResult.count ?? 0;
  const completedCount = completedResult.count ?? 0;
  const completionRate = totalEnrollments > 0
    ? Math.round((completedCount / totalEnrollments) * 100)
    : 0;

  // Compute average score from completed enrollments
  const { data: scoredEnrollments } = await service
    .from('enrollments')
    .select('score')
    .eq('status', 'completed')
    .not('score', 'is', null);
  const scoresArr = (scoredEnrollments ?? [])
    .map((e) => Number(e.score))
    .filter((s) => !isNaN(s));
  const avgScore = scoresArr.length > 0
    ? Math.round((scoresArr.reduce((a, b) => a + b, 0) / scoresArr.length) * 10) / 10
    : 0;

  // Compute real completion rates for top courses
  const topCourseIds = (topCoursesResult.data ?? []).map((c) => c.id);
  const { data: topCourseEnrollments } = await service
    .from('enrollments')
    .select('course_id, status')
    .in('course_id', topCourseIds.length > 0 ? topCourseIds : ['__none__']);

  const courseEnrollmentMap: Record<string, { total: number; completed: number }> = {};
  for (const e of topCourseEnrollments ?? []) {
    if (!courseEnrollmentMap[e.course_id]) {
      courseEnrollmentMap[e.course_id] = { total: 0, completed: 0 };
    }
    courseEnrollmentMap[e.course_id].total += 1;
    if (e.status === 'completed') {
      courseEnrollmentMap[e.course_id].completed += 1;
    }
  }

  const topCourses = (topCoursesResult.data ?? []).map((c) => {
    const stats = courseEnrollmentMap[c.id] ?? { total: 0, completed: 0 };
    return {
      name: c.title,
      completionRate: stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0,
    };
  });

  // Build recent activity from recent enrollments
  const { data: recentEnrollments } = await service
    .from('enrollments')
    .select('*, user:users(first_name, last_name), course:courses(title)')
    .order('enrolled_at', { ascending: false })
    .limit(7);

  const recentActivity = (recentEnrollments ?? []).map((e, i) => {
    const userName = e.user
      ? `${e.user.first_name} ${e.user.last_name}`
      : 'A user';
    const courseName = e.course?.title ?? 'a course';
    const isCompleted = e.status === 'completed';
    return {
      id: e.id || String(i),
      action: isCompleted ? 'completed' : 'enrolled in',
      user: userName,
      target: courseName,
      time: getRelativeTime(e.enrolled_at),
      type: isCompleted ? 'completed' : 'enrolled',
    };
  });

  const data: DashboardData = {
    totalUsers,
    activeCourses,
    enrollmentsThisMonth,
    completionRate,
    avgScore,
    complianceRate: completionRate,
    topCourses,
    recentActivity,
  };

  return <DashboardClient data={data} />;
}

function getRelativeTime(dateStr: string | null): string {
  if (!dateStr) return 'recently';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 60) return `${diffMin} minutes ago`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `${diffHrs} hours ago`;
  const diffDays = Math.floor(diffHrs / 24);
  return `${diffDays} days ago`;
}
