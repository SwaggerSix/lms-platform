import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * GET /api/assessments/export — server-to-server export of the assessment
 * bank for the coaching platform's "Sync from LMS" feature.
 *
 * Auth: `Authorization: Bearer ${ASSESSMENT_EXPORT_SECRET}` (shared secret,
 * timing-safe comparison — same pattern as the partner-portal inbound auth).
 * Returns only published, natively-authored assessments; SurveyCraft-embedded
 * ones (external_provider set) can't be replicated outside the LMS and are
 * excluded. Includes the answer key (is_correct / correct_answer) — the
 * consumer grades submissions server-side and never ships the key to clients.
 */

function verifyExportSecret(authHeader: string | null): boolean {
  const secret = process.env.ASSESSMENT_EXPORT_SECRET;
  const provided = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!secret || !provided) return false;
  try {
    const a = Buffer.from(provided);
    const b = Buffer.from(secret);
    // Length check first: timingSafeEqual throws on length mismatch.
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  if (!verifyExportSecret(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const service = createServiceClient();
  const { data, error } = await service
    .from("assessments")
    .select("*, questions(*)")
    .eq("status", "published")
    .is("external_provider", null)
    .order("created_at", { ascending: true })
    .limit(500);

  if (error) {
    console.error("Assessment export error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  type QuestionRow = Record<string, unknown> & {
    id: string;
    question_text: string;
    question_type: string;
    options: unknown;
    points: number | null;
    explanation: string | null;
    sequence_order: number | null;
  };

  const assessments = (data ?? []).map((a) => {
    const questions = ((a.questions ?? []) as QuestionRow[])
      .slice()
      .sort((x, y) => (x.sequence_order ?? 0) - (y.sequence_order ?? 0))
      .map((q) => ({
        id: q.id,
        question_text: q.question_text,
        question_type: q.question_type,
        options: Array.isArray(q.options) ? q.options : [],
        // correct_answer exists in the live DB but not in the checked-in
        // migrations (used for fill_blank grading) — read it defensively.
        correct_answer: (q as { correct_answer?: string | null }).correct_answer ?? null,
        points: q.points ?? 1,
        explanation: q.explanation ?? null,
        sequence_order: q.sequence_order ?? 0,
      }));

    return {
      id: a.id,
      title: a.title,
      description: a.description ?? null,
      passing_score: a.passing_score ?? null,
      time_limit: a.time_limit ?? null,
      show_correct_answers: a.show_correct_answers ?? true,
      question_count: questions.length,
      questions,
    };
  });

  return NextResponse.json({ assessments });
}
