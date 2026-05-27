import { authorize } from "@/lib/auth/authorize";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { mintEmbedToken, buildEmbedUrl } from "@/lib/evaluations/surveycraft";

// Returns the SurveyCraft embed URL for the current user's assignment, with a
// freshly minted correlation token. Authorized via the normal session.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorize();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id: assignmentId } = await params;

  const service = createServiceClient();

  const { data: assignment, error } = await service
    .from("evaluation_assignments")
    .select(`
      id, user_id, template_id,
      template:evaluation_templates(surveycraft_slug)
    `)
    .eq("id", assignmentId)
    .single();

  if (error || !assignment) {
    return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
  }

  if (assignment.user_id !== auth.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const template = Array.isArray(assignment.template) ? assignment.template[0] : assignment.template;
  const slug = template?.surveycraft_slug;
  if (!slug) {
    return NextResponse.json({ error: "Assignment has no external survey configured" }, { status: 400 });
  }

  const token = mintEmbedToken({
    assignmentId: assignment.id,
    userId: assignment.user_id,
    tenant: request.headers.get("x-tenant-slug") ?? "",
    templateId: assignment.template_id,
  });

  return NextResponse.json({ embed_url: buildEmbedUrl(slug, token) });
}
