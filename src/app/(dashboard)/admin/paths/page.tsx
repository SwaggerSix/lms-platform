import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import PathsClient, { type LearningPath, type PathCourse } from './paths-client';

const courseTypeMap: Record<string, string> = {
  self_paced: 'Self-Paced',
  instructor_led: 'Instructor-Led',
  blended: 'Blended',
};

export default async function PathsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Fetch all learning paths with their items (including linked course info) and enrollment counts
  const { data: rows } = await supabase
    .from('learning_paths')
    .select(
      '*, items:learning_path_items(id, sequence_order, course:courses(id, title, estimated_duration, course_type)), enrollments:learning_path_enrollments(id)'
    )
    .order('created_at', { ascending: false });

  const paths: LearningPath[] = (rows ?? []).map((row: any) => {
    const items = (row.items ?? [])
      .sort((a: any, b: any) => (a.sequence_order ?? 0) - (b.sequence_order ?? 0));

    const courses: PathCourse[] = items.map((item: any) => ({
      id: item.course?.id ?? item.id,
      title: item.course?.title ?? 'Untitled Course',
      duration: item.course?.estimated_duration ?? 0,
      type: courseTypeMap[item.course?.course_type] ?? 'Self-Paced',
    }));

    return {
      id: row.id,
      title: row.title ?? 'Untitled Path',
      description: row.description ?? '',
      courseCount: items.length,
      enrolled: (row.enrollments ?? []).length,
      status: row.status ?? 'draft',
      totalDuration: row.estimated_duration ?? courses.reduce((sum: number, c: PathCourse) => sum + c.duration, 0),
      courses,
    };
  });

  return <PathsClient paths={paths} />;
}
