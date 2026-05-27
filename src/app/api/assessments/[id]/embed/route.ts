import { authorize } from "@/lib/auth/authorize";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { mintEmbedToken, buildEmbedUrl } from "@/lib/evaluations/surveycraft";

// Returns the SurveyCraft embed URL for an externally-authored assessment, with a
// freshly minted correlation token. Authorized via the normal session; the token
// carries the current user's id so the inbound webhook can record their attempt.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorize();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id: assessmentId } = await params;

  const service = createServiceClient();

  const { data: assessment, error } = await service
    .from("assessments")
    .select("id, external_provider, surveycraft_slug")
    .eq("id", assessmentId)
    .single();

  if (error || !assessment) {
    return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
  }

  if (assessment.external_provider !== "surveycraft" || !assessment.surveycraft_slug) {
    return NextResponse.json({ error: "Assessment has no external survey configured" }, { status: 400 });
  }

  const token = mintEmbedToken({
    assignmentId: assessment.id,
    userId: auth.user.id,
    tenant: request.headers.get("x-tenant-slug") ?? "",
    templateId: assessment.id,
    kind: "assessment",
  });

  return NextResponse.json({ embed_url: buildEmbedUrl(assessment.surveycraft_slug, token) });
}
