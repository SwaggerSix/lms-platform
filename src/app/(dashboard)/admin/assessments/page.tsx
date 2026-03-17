import type { Metadata } from "next";
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AssessmentsClient, { type Assessment, type Question, type QuestionType } from './assessments-client';

export const metadata: Metadata = {
  title: "Assessments | LMS Platform",
  description: "Create and manage quizzes, tests, and assessments for courses",
};

const questionTypeMap: Record<string, QuestionType> = {
  multiple_choice: 'multiple-choice',
  'multiple-choice': 'multiple-choice',
  true_false: 'true-false',
  'true-false': 'true-false',
  short_answer: 'short-answer',
  'short-answer': 'short-answer',
  multi_select: 'multi-select',
  'multi-select': 'multi-select',
};

export default async function AssessmentsPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Fetch assessments with course name join
  const { data: assessmentRows } = await supabase
    .from('assessments')
    .select('*, course:courses(title)')
    .order('created_at', { ascending: false });

  // Fetch all questions ordered by sequence
  const { data: questionRows } = await supabase
    .from('questions')
    .select('*')
    .order('sequence_order', { ascending: true });

  // Fetch attempt statistics per assessment (count + avg score)
  const { data: attemptRows } = await supabase
    .from('assessment_attempts')
    .select('assessment_id, score')
    .limit(200);

  // Group questions by assessment_id
  const questionsByAssessment = new Map<string, Question[]>();
  for (const q of (questionRows ?? []) as any[]) {
    const list = questionsByAssessment.get(q.assessment_id) ?? [];
    list.push({
      id: q.id,
      text: q.question_text ?? '',
      type: questionTypeMap[q.question_type] ?? 'multiple-choice',
      points: q.points ?? 0,
    });
    questionsByAssessment.set(q.assessment_id, list);
  }

  // Compute attempt stats per assessment
  const attemptStats = new Map<string, { count: number; totalScore: number }>();
  for (const a of (attemptRows ?? []) as any[]) {
    const stats = attemptStats.get(a.assessment_id) ?? { count: 0, totalScore: 0 };
    stats.count += 1;
    stats.totalScore += Number(a.score ?? 0);
    attemptStats.set(a.assessment_id, stats);
  }

  const assessments: Assessment[] = ((assessmentRows ?? []) as any[]).map((row) => {
    const questions = questionsByAssessment.get(row.id) ?? [];
    const stats = attemptStats.get(row.id);
    const avgScore = stats && stats.count > 0 ? Math.round(stats.totalScore / stats.count) : 0;
    const attemptCount = stats?.count ?? 0;

    // Determine status: if there are attempts or question_count > 0 treat as active, else draft
    const hasContent = (row.question_count ?? questions.length) > 0 && attemptCount > 0;
    const status: 'active' | 'draft' = hasContent ? 'active' : 'draft';

    return {
      id: row.id,
      title: row.title ?? 'Untitled Assessment',
      course: row.course?.title ?? 'Unlinked Course',
      questionCount: row.question_count ?? questions.length,
      passingScore: row.passing_score ?? 70,
      avgScore,
      attempts: attemptCount,
      status,
      questions,
    };
  });

  // Fetch courses for the dropdown
  const { data: courseRows } = await supabase
    .from('courses')
    .select('id, title')
    .order('title', { ascending: true });

  const courses = ((courseRows ?? []) as any[]).map((c) => ({
    id: c.id as string,
    title: c.title as string,
  }));

  return <AssessmentsClient assessments={assessments} courses={courses} />;
}
