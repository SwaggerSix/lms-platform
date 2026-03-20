import { authorize } from "@/lib/auth/authorize";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function GET(request: NextRequest, { params }: { params: Promise<{ courseId: string }> }) {
  const auth = await authorize("admin", "super_admin", "manager");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { courseId } = await params;
  const service = createServiceClient();

  // Fetch all assignments for this course with their responses
  const { data: assignments, error } = await service
    .from("evaluation_assignments")
    .select(`
      id, status, completed_at,
      user:users(id, first_name, last_name, email),
      template:evaluation_templates(id, name, level, questions),
      response:evaluation_responses(id, answers, submitted_at)
    `)
    .eq("course_id", courseId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Evaluation report GET error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  // Aggregate stats per template
  const templateMap: Record<string, {
    template_id: string;
    template_name: string;
    level: number;
    total_assigned: number;
    total_completed: number;
    completion_rate: number;
    question_summaries: Record<string, { question_text: string; type: string; responses: unknown[]; avg?: number }>;
  }> = {};

  for (const assignment of assignments ?? []) {
    const template = (Array.isArray(assignment.template) ? assignment.template[0] : assignment.template) as { id: string; name: string; level: number; questions: Array<{ id: string; text: string; type: string }> } | null;
    if (!template) continue;

    if (!templateMap[template.id]) {
      templateMap[template.id] = {
        template_id: template.id,
        template_name: template.name,
        level: template.level,
        total_assigned: 0,
        total_completed: 0,
        completion_rate: 0,
        question_summaries: {},
      };

      for (const q of template.questions ?? []) {
        templateMap[template.id].question_summaries[q.id] = {
          question_text: q.text,
          type: q.type,
          responses: [],
        };
      }
    }

    const bucket = templateMap[template.id];
    bucket.total_assigned++;

    const responses = assignment.response as Array<{ answers: Record<string, unknown>; submitted_at: string }> | null;
    if (assignment.status === "completed" && responses && responses.length > 0) {
      bucket.total_completed++;
      const answers = responses[0].answers as Record<string, unknown>;
      for (const [qId, value] of Object.entries(answers)) {
        if (bucket.question_summaries[qId]) {
          bucket.question_summaries[qId].responses.push(value);
        }
      }
    }
  }

  // Compute completion rates and numeric averages for rating/nps questions
  const summaries = Object.values(templateMap).map(bucket => {
    bucket.completion_rate = bucket.total_assigned > 0
      ? Math.round((bucket.total_completed / bucket.total_assigned) * 100)
      : 0;

    for (const qs of Object.values(bucket.question_summaries)) {
      if (["rating", "nps"].includes(qs.type) && qs.responses.length > 0) {
        const nums = qs.responses.filter(r => typeof r === "number") as number[];
        qs.avg = nums.length > 0 ? Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10 : undefined;
      }
    }

    return bucket;
  });

  return NextResponse.json({
    course_id: courseId,
    total_assignments: assignments?.length ?? 0,
    summaries,
  });
}
