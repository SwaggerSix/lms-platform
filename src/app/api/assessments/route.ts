import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { authorize } from "@/lib/auth/authorize";
import { NextRequest, NextResponse } from "next/server";
import { validateBody, createAssessmentSchema } from "@/lib/validations";

export async function GET(request: NextRequest) {
  const auth = await authorize();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const isAdmin = auth.user.role === "admin";
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const courseId = searchParams.get("course_id");
  const id = searchParams.get("id");
  const service = createServiceClient();

  if (id) {
    const { data, error } = await service
      .from("assessments")
      .select("*, questions(*)")
      .eq("id", id)
      .single();

    if (error) {
    console.error("Assessments API error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

    if (!isAdmin && data) {
      data.questions = (data.questions ?? []).map((q: Record<string, unknown>) => ({
        ...q,
        options: Array.isArray(q.options)
          ? (q.options as Record<string, unknown>[]).map(({ is_correct, ...opt }: Record<string, unknown>) => opt)
          : q.options,
      }));
    }

    return NextResponse.json(data);
  }

  let query = service
    .from("assessments")
    .select("*, questions(count)")
    .order("created_at", { ascending: false });

  if (courseId) query = query.eq("course_id", courseId);

  const { data, error } = await query;
  if (error) {
    console.error("Assessments API error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const auth = await authorize("admin", "instructor");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabase = await createClient();
  const body = await request.json();
  const validation = validateBody(createAssessmentSchema, body);
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const assessmentData = validation.data;
  const { questions } = body;
  const service = createServiceClient();

  const { data: assessment, error } = await service
    .from("assessments")
    .insert(assessmentData)
    .select()
    .single();

  if (error) {
    console.error("Assessments API error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  if (questions?.length) {
    const questionsWithId = questions.map((q: Record<string, unknown>, i: number) => ({
      question_text: q.question_text,
      question_type: q.question_type,
      options: q.options,
      correct_answer: q.correct_answer,
      points: q.points,
      explanation: q.explanation,
      assessment_id: assessment.id,
      sequence_order: i + 1,
    }));

    const { error: qError } = await service.from("questions").insert(questionsWithId);
    if (qError) {
      console.error("Assessments API error:", qError.message);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
  }

  return NextResponse.json(assessment, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const auth = await authorize("admin", "instructor");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabase = await createClient();
  const body = await request.json();
  const { id, questions } = body;

  if (!id) {
    return NextResponse.json({ error: "Assessment id is required" }, { status: 400 });
  }

  const allowedFields = ["title", "description", "course_id", "type", "passing_score", "time_limit", "max_attempts", "status"] as const;
  const updates: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (body[field] !== undefined) updates[field] = body[field];
  }
  const service = createServiceClient();

  const { data, error } = await service
    .from("assessments")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Assessments API error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  if (questions?.length) {
    await service.from("questions").delete().eq("assessment_id", id);
    const questionsWithId = questions.map((q: Record<string, unknown>, i: number) => ({
      question_text: q.question_text,
      question_type: q.question_type,
      options: q.options,
      correct_answer: q.correct_answer,
      points: q.points,
      explanation: q.explanation,
      assessment_id: id,
      sequence_order: i + 1,
    }));
    await service.from("questions").insert(questionsWithId);
  }

  return NextResponse.json(data);
}

export async function DELETE(request: NextRequest) {
  const auth = await authorize("admin", "instructor");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Assessment id is required" }, { status: 400 });
  }
  const service = createServiceClient();

  const { error } = await service
    .from("assessments")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Assessments API error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ message: "Assessment deleted" });
}
