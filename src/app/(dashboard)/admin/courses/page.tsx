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
  "bg-gradient-to-br from-blue-400 to-primary-600",
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

// Maps a DataTable column key to the DB column used for server-side sort.
const SORT_COLUMNS: Record<string, string> = {
  course: "title",
  status: "status",
  type: "course_type",
  duration: "estimated_duration",
};

const STATUSES = ["published", "draft", "archived"] as const;
const TYPES = ["self_paced", "instructor_led", "blended"];
const LEVELS = ["beginner", "intermediate", "advanced"];

const PAGE_SIZE = 12;

export default async function CoursesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const sp = await searchParams;
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

  // ─── Server-driven paging / filtering / sorting (same pattern as /admin/users) ───
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  // Sanitize search: PostgREST ilike breaks on , ( ) % * \, so strip them.
  const q = (sp.q ?? "").replace(/[,()%*\\]/g, " ").trim();
  const statusParam = STATUSES.includes(sp.status as any) ? sp.status! : null;
  const catParam = sp.cat || null;
  const typeParam = TYPES.includes(sp.type ?? "") ? sp.type! : null;
  const levelParam = LEVELS.includes(sp.level ?? "") ? sp.level! : null;
  const sort = sp.sort ?? "-created_at";
  const sortDesc = sort.startsWith("-");
  const sortField = SORT_COLUMNS[sort.replace(/^-/, "")] ?? "created_at";

  let query = service
    .from('courses')
    .select('*, category:categories(name)', { count: 'exact' });

  if (q) query = query.ilike('title', `%${q}%`);
  if (statusParam) query = query.eq('status', statusParam);
  if (catParam) query = query.eq('category_id', catParam);
  if (typeParam) query = query.eq('course_type', typeParam);
  if (levelParam) query = query.eq('difficulty_level', levelParam);

  // The status-tab counts are always unfiltered (matching the previous
  // client behavior where tabs counted the whole catalog).
  const countByStatus = (status?: string) => {
    let cq = service.from('courses').select('id', { count: 'exact', head: true });
    if (status) cq = cq.eq('status', status);
    return cq;
  };

  const [
    { data: rows, count },
    { data: categoryRows },
    { count: allCount },
    { count: publishedCount },
    { count: draftCount },
    { count: archivedCount },
  ] = await Promise.all([
    query
      .order(sortField, { ascending: !sortDesc })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1),
    service.from('categories').select('id, name').order('name'),
    countByStatus(),
    countByStatus('published'),
    countByStatus('draft'),
    countByStatus('archived'),
  ]);

  const categoryOptions = (categoryRows ?? []).map((c: any) => ({ id: c.id, name: c.name }));

  // Aggregate real enrollment/completion numbers — but only for the courses on
  // this page, instead of fetching the entire (high-growth) enrollments table.
  const pageIds = (rows ?? []).map((r: any) => r.id);
  const enrollmentStats: Record<string, { total: number; completed: number }> = {};
  if (pageIds.length > 0) {
    const { data: enrollmentRows } = await service
      .from('enrollments')
      .select('course_id, status')
      .in('course_id', pageIds);
    for (const e of enrollmentRows ?? []) {
      if (!e.course_id) continue;
      const stats = (enrollmentStats[e.course_id] ??= { total: 0, completed: 0 });
      stats.total += 1;
      if (e.status === 'completed') stats.completed += 1;
    }
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

  return (
    <CoursesClient
      courses={courses}
      categoryOptions={categoryOptions}
      totalCount={count ?? courses.length}
      statusCounts={{
        all: allCount ?? 0,
        published: publishedCount ?? 0,
        draft: draftCount ?? 0,
        archived: archivedCount ?? 0,
      }}
      page={page}
      pageSize={PAGE_SIZE}
      sort={sort}
    />
  );
}
