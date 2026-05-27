import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createServiceClient } from "@/lib/supabase/service";
import { verifyEmbedToken } from "@/lib/evaluations/surveycraft";

const MAX_CLOCK_SKEW_SECONDS = 300;

// Inbound machine-to-machine webhook from SurveyCraft. Trust comes from the
// request HMAC (LMS_WEBHOOK_SECRET) plus the signed embed token, not a session.
export async function POST(request: NextRequest) {
  const secret = process.env.LMS_WEBHOOK_SECRET;
  if (!secret) {
    // Misconfigured — never silently accept unsigned webhooks.
    console.error("LMS_WEBHOOK_SECRET is not configured");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }

  const requestId = request.headers.get("x-lm-request-id");
  const timestamp = request.headers.get("x-lm-timestamp");
  const signature = request.headers.get("x-lm-signature");
  if (!requestId || !timestamp || !signature) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(Math.floor(Date.now() / 1000) - ts) > MAX_CLOCK_SKEW_SECONDS) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Read the RAW body before parsing — the signature is over the exact bytes.
  const rawBody = await request.text();
  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${requestId}.${rawBody}`)
    .digest("hex");

  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    event?: string;
    responseId?: string;
    surveyId?: string;
    slug?: string;
    lmsToken?: string;
    completedAt?: string;
    answers?: Record<string, unknown>;
    questions?: unknown[];
  };
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (body.event !== "survey.completed" || !body.lmsToken) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const payload = verifyEmbedToken(body.lmsToken);
  if (!payload) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const assignmentId = payload.a;
  const service = createServiceClient();

  const { data: assignment, error: assignmentError } = await service
    .from("evaluation_assignments")
    .select("id, user_id, status")
    .eq("id", assignmentId)
    .single();

  if (assignmentError || !assignment) {
    return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
  }

  // Idempotency: if a response already exists for this assignment, treat the
  // delivery as a duplicate (SurveyCraft may retry) and do not double-write.
  const { data: existing, error: existingError } = await service
    .from("evaluation_responses")
    .select("id")
    .eq("assignment_id", assignmentId)
    .limit(1)
    .maybeSingle();

  if (existingError) {
    console.error("Evaluation webhook duplicate-check error:", existingError.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  if (existing) {
    return NextResponse.json({ status: "duplicate" }, { status: 200 });
  }

  const now = body.completedAt || new Date().toISOString();

  const { error: responseError } = await service
    .from("evaluation_responses")
    .insert({
      assignment_id: assignmentId,
      user_id: assignment.user_id,
      answers: {
        responseId: body.responseId ?? null,
        surveyId: body.surveyId ?? null,
        slug: body.slug ?? null,
        answers: body.answers ?? {},
        questions: body.questions ?? [],
      },
      submitted_at: now,
    });

  if (responseError) {
    console.error("Evaluation webhook response insert error:", responseError.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  const { error: updateError } = await service
    .from("evaluation_assignments")
    .update({ status: "completed", completed_at: now })
    .eq("id", assignmentId);

  if (updateError) {
    console.error("Evaluation webhook assignment update error:", updateError.message);
    // Response was saved — don't fail the request, just log.
  }

  return NextResponse.json({ status: "ok" }, { status: 200 });
}
