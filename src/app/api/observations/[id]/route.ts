import { authorize } from "@/lib/auth/authorize";
import { createServiceClient } from "@/lib/supabase/service";
import { NextRequest, NextResponse } from "next/server";
import { validateBody, updateObservationSchema } from "@/lib/validations";
import { jsonNoStore } from "@/lib/api/no-store";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorize("admin", "manager", "instructor", "learner");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const service = createServiceClient();

  const { data, error } = await service
    .from("observations")
    .select(`
      *,
      template:observation_templates(id, name, description, category, items, passing_score),
      observer:users!observations_observer_id_fkey(id, first_name, last_name, email),
      subject:users!observations_subject_id_fkey(id, first_name, last_name, email),
      course:courses(id, title),
      sign_off_user:users!observations_sign_off_by_fkey(id, first_name, last_name),
      attachments:observation_attachments(id, file_url, file_name, file_type, created_at)
    `)
    .eq("id", id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Observation not found" }, { status: 404 });
  }

  // Check access: observer, subject, admin, or manager
  const isAdmin = auth.user.role === "admin" || auth.user.role === "manager";
  const isParticipant = data.observer_id === auth.user.id || data.subject_id === auth.user.id;
  if (!isAdmin && !isParticipant) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  return NextResponse.json({ observation: data });
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorize("admin", "manager", "instructor");
  if (!auth.authorized) return jsonNoStore({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const body = await request.json();
  const validation = validateBody(updateObservationSchema, body);
  if (!validation.success) return jsonNoStore({ error: validation.error }, { status: 400 });

  const service = createServiceClient();

  // Check ownership or admin status
  const { data: existing } = await service
    .from("observations")
    .select("observer_id, status")
    .eq("id", id)
    .single();

  if (!existing) {
    return jsonNoStore({ error: "Observation not found" }, { status: 404 });
  }

  const isAdmin = auth.user.role === "admin" || auth.user.role === "manager";
  if (!isAdmin && existing.observer_id !== auth.user.id) {
    return jsonNoStore({ error: "Only the observer can update this observation" }, { status: 403 });
  }

  // Cannot edit signed-off observations
  if (existing.status === "signed_off" && !isAdmin) {
    return jsonNoStore({ error: "Cannot modify a signed-off observation" }, { status: 400 });
  }

  const updateData: Record<string, unknown> = { ...validation.data };

  // Auto-set completed_at when status changes to completed
  if (validation.data.status === "completed" && existing.status !== "completed") {
    updateData.completed_at = new Date().toISOString();
  }

  const { data, error } = await service
    .from("observations")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Observation PUT error:", error.message);
    return jsonNoStore({ error: "Failed to update observation" }, { status: 500 });
  }

  return jsonNoStore({ observation: data });
}
