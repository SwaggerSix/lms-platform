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
  if (!dbUser || dbUser.role !== "admin") redirect("/dashboard");

  const { data: rows, error } = await service
    .from('courses')
    .select('*, category:categories(name)')
    .order('created_at', { ascending: false });

  const courses: CourseItem[] = (rows ?? []).map((row: any, index: number) => {
    const isPublished = row.status === 'published';
    // Derive a deterministic pseudo-random number from the row id for placeholder stats
    const seed = row.id
      ? row.id.split('').reduce((acc: number, ch: string) => acc + ch.charCodeAt(0), 0)
      : index;

    return {
      id: row.id,
      title: row.title ?? 'Untitled Course',
      status: row.status ?? 'draft',
      type: courseTypeMap[row.course_type] ?? 'self-paced',
      category: row.category?.name ?? 'General',
      difficulty: difficultyMap[row.difficulty_level] ?? 'beginner',
      enrolled: isPublished ? 100 + (seed * 37) % 900 : 0,
      completionRate: isPublished ? 60 + (seed * 13) % 35 : 0,
      duration: row.estimated_duration ?? 0,
      thumbnail: GRADIENTS[index % GRADIENTS.length],
    };
  });

  return <CoursesClient courses={courses} />;
}
