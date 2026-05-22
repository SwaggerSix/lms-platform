import { authorize } from "@/lib/auth/authorize";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { validateBody, submitEvaluationResponseSchema } from "@/lib/validations";
import { rateLimit } from "@/lib/rate-limit";
import { jsonNoStore } from "@/lib/api/no-store";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorize();
  if (!auth.authorized) return jsonNoStore({ error: auth.error }, { status: auth.status });

  const rl = await rateLimit(`eval-respond-${auth.user.id}`, 30, 60000);
  if (!rl.success) return jsonNoStore({ error: "Rate limit exceeded" }, { status: 429 });

  const { id: assignmentId } = await params;

  let body;
  try { body = await request.json(); } catch {
    return jsonNoStore({ error: "Invalid JSON body" }, { status: 400 });
  }

  const validation = validateBody(submitEvaluationResponseSchema, body);
  if (!validation.success) return jsonNoStore({ error: validation.error }, { status: 400 });

  const service = createServiceClient();

  // Verify assignment belongs to this user and is still pending
  const { data: assignment, error: assignmentError } = await service
    .from("evaluation_assignments")
    .select("id, user_id, status, template_id")
    .eq("id", assignmentId)
    .single();

  if (assignmentError || !assignment) {
    return jsonNoStore({ error: "Assignment not found" }, { status: 404 });
  }

  if (assignment.user_id !== auth.user.id) {
    return jsonNoStore({ error: "Forbidden" }, { status: 403 });
  }

  if (assignment.status === "completed") {
    return jsonNoStore({ error: "Assignment already completed" }, { status: 409 });
  }

  if (assignment.status === "expired") {
    return jsonNoStore({ error: "Assignment has expired" }, { status: 410 });
  }

  // Insert response and mark assignment complete atomically
  const now = new Date().toISOString();

  const { data: response, error: responseError } = await service
    .from("evaluation_responses")
    .insert({
      assignment_id: assignmentId,
      user_id: auth.user.id,
      answers: validation.data.answers,
      submitted_at: now,
    })
    .select()
    .single();

  if (responseError) {
    console.error("Evaluation response insert error:", responseError.message);
    return jsonNoStore({ error: "Internal server error" }, { status: 500 });
  }

  const { error: updateError } = await service
    .from("evaluation_assignments")
    .update({ status: "completed", completed_at: now })
    .eq("id", assignmentId);

  if (updateError) {
    console.error("Evaluation assignment update error:", updateError.message);
    // Response was saved — don't fail the request, just log
  }

  return jsonNoStore(response, { status: 201 });
}
