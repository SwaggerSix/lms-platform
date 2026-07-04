import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from "@/lib/supabase/service";
import CoursesClient, { type CourseItem } from './courses-client';

export const metadata: Metadata = {
  title: "Manage Courses | LMS Platform",
  description: "Create, edit, and manage courses across the platform",
};

const GRADIENTS = [
  "bg-gradient-to-br from-green-400 to-emerald-600",
  "bg-gradient-to-br from-blue-400 to-indigo-600",
  "bg-gradient-to-br from-purple-400 to-violet-600",
  "bg-gradient-to-br from-emerald-400 to-teal-600",
  "bg-gradient-to-br from-amber-400 to-orange-600",
  "bg-gradient-to-br from-yellow-400 to-amber-600",
  "bg-gradient-to-br from-red-400 to-rose-600",
  "bg-gradient-to-br from-pink-400 to-fuchsia-600",
];

const courseTypeMap: Record<string, CourseItem['type']> = {
  self_paced: 'self-paced',
  instructor_led: 'instructor-led',
  blended: 'blended',
};

const difficultyMap: Record<string, CourseItem['difficulty']> = {
  beginner: 'beginner',
  intermediate: 'intermediate',
  advanced: 'advanced',
};

export default async function CoursesPage() {
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

  const { data: rows, error } = await service
    .from('courses')
    .select('*, category:categories(name)')
    .order('created_at', { ascending: false });

  const { data: categoryRows } = await service
    .from('categories')
    .select('id, name')
    .order('name');

  const categoryOptions = (categoryRows ?? []).map((c: any) => ({ id: c.id, name: c.name }));

  // Aggregate real enrollment/completion numbers per course.
  const { data: enrollmentRows } = await service
    .from('enrollments')
    .select('course_id, status');
  const enrollmentStats: Record<string, { total: number; completed: number }> = {};
  for (const e of enrollmentRows ?? []) {
    if (!e.course_id) continue;
    const stats = (enrollmentStats[e.course_id] ??= { total: 0, completed: 0 });
    stats.total += 1;
    if (e.status === 'completed') stats.completed += 1;
  }

  const courses: CourseItem[] = (rows ?? []).map((row: any, index: number) => {
    const stats = enrollmentStats[row.id] ?? { total: 0, completed: 0 };

    return {
      id: row.id,
      title: row.title ?? 'Untitled Course',
      slug: row.slug ?? '',
      status: row.status ?? 'draft',
      type: courseTypeMap[row.course_type] ?? 'self-paced',
      category: row.category?.name ?? 'General',
      categoryId: row.category_id ?? '',
      difficulty: difficultyMap[row.difficulty_level] ?? 'beginner',
      enrolled: stats.total,
      completionRate: stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0,
      duration: row.estimated_duration ?? 0,
      thumbnail: GRADIENTS[index % GRADIENTS.length],
      coverUrl: row.thumbnail_url ?? null,
      availableFrom: row.available_from ?? null,
      availableUntil: row.available_until ?? null,
      updatedAt: row.updated_at ?? null,
    };
  });

  return <CoursesClient courses={courses} categoryOptions={categoryOptions} />;
}
