import { authorize } from "@/lib/auth/authorize";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorize();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const subjectId = searchParams.get("subject_id") || auth.user.id;

  const service = createServiceClient();

  // Get cycle info
  const { data: cycle } = await service
    .from("feedback_cycles")
    .select("*")
    .eq("id", id)
    .single();

  if (!cycle) {
    return NextResponse.json({ error: "Cycle not found" }, { status: 404 });
  }

  // Only admins/managers can view other people's reports
  if (subjectId !== auth.user.id) {
    const { data: dbUser } = await service.from("users").select("role").eq("id", auth.user.id).single();
    if (!dbUser || !["admin", "manager"].includes(dbUser.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  // Get all completed nominations for this subject in this cycle
  const { data: nominations } = await service
    .from("feedback_nominations")
    .select(`
      *,
      reviewer:users!feedback_nominations_reviewer_id_fkey(id, first_name, last_name),
      responses:feedback_responses(*)
    `)
    .eq("cycle_id", id)
    .eq("subject_id", subjectId)
    .eq("status", "completed");

  if (!nominations || nominations.length === 0) {
    return NextResponse.json({
      cycle,
      subject_id: subjectId,
      summary: { total_responses: 0, by_relationship: {} },
      competency_scores: [],
      comments: [],
      rating_averages: {},
    });
  }

  // Aggregate responses
  const byRelationship: Record<string, number> = {};
  const ratingAccumulator: Record<string, { sum: number; count: number }> = {};
  const competencyScores: Record<string, { name: string; scores: number[] }> = {};
  const comments: Array<{ relationship: string; text: string }> = [];

  for (const nom of nominations) {
    byRelationship[nom.relationship] = (byRelationship[nom.relationship] || 0) + 1;

    for (const response of (nom.responses || [])) {
      if (response.is_draft) continue;
      const answers = response.answers as Record<string, any>;

      for (const [questionId, answer] of Object.entries(answers)) {
        if (typeof answer === "number") {
          if (!ratingAccumulator[questionId]) {
            ratingAccumulator[questionId] = { sum: 0, count: 0 };
          }
          ratingAccumulator[questionId].sum += answer;
          ratingAccumulator[questionId].count += 1;
        } else if (typeof answer === "string" && answer.trim()) {
          // If anonymous, don't reveal relationship for self reviews
          const rel = cycle.anonymous ? "anonymous" : nom.relationship;
          comments.push({ relationship: rel, text: answer });
        } else if (typeof answer === "object" && answer !== null && "competency" in answer) {
          const comp = answer as { competency: string; name: string; score: number };
          if (!competencyScores[comp.competency]) {
            competencyScores[comp.competency] = { name: comp.name || comp.competency, scores: [] };
          }
          competencyScores[comp.competency].scores.push(comp.score);
        }
      }
    }
  }

  const ratingAverages: Record<string, number> = {};
  for (const [qId, acc] of Object.entries(ratingAccumulator)) {
    ratingAverages[qId] = Math.round((acc.sum / acc.count) * 100) / 100;
  }

  const competencyAverages = Object.entries(competencyScores).map(([id, data]) => ({
    competency_id: id,
    name: data.name,
    average: Math.round((data.scores.reduce((a, b) => a + b, 0) / data.scores.length) * 100) / 100,
    count: data.scores.length,
  }));

  return NextResponse.json({
    cycle,
    subject_id: subjectId,
    summary: {
      total_responses: nominations.length,
      by_relationship: byRelationship,
    },
    competency_scores: competencyAverages,
    comments,
    rating_averages: ratingAverages,
  });
}
