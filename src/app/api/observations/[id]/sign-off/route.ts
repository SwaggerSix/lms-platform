import { authorize } from "@/lib/auth/authorize";
import { createServiceClient } from "@/lib/supabase/service";
import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { validateBody, signOffObservationSchema } from "@/lib/validations";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorize("admin", "manager");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const rl = await rateLimit(`obs-signoff-${auth.user.id}`, 20, 60000);
  if (!rl.success) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const validation = validateBody(signOffObservationSchema, body);
  if (!validation.success) return NextResponse.json({ error: validation.error }, { status: 400 });

  const service = createServiceClient();

  // Verify observation exists and is completed
  const { data: observation } = await service
    .from("observations")
    .select("id, status, observer_id")
    .eq("id", id)
    .single();

  if (!observation) {
    return NextResponse.json({ error: "Observation not found" }, { status: 404 });
  }

  if (observation.status !== "completed") {
    return NextResponse.json(
      { error: "Observation must be completed before sign-off" },
      { status: 400 }
    );
  }

  // Signer cannot be the observer (separation of duties)
  if (observation.observer_id === auth.user.id) {
    return NextResponse.json(
      { error: "Observer cannot sign off their own observation" },
      { status: 400 }
    );
  }

  const updateData: Record<string, unknown> = {
    status: "signed_off",
    sign_off_by: auth.user.id,
    signed_off_at: new Date().toISOString(),
  };

  if (validation.data.notes) {
    // Append sign-off notes to existing notes
    const { data: existing } = await service
      .from("observations")
      .select("notes")
      .eq("id", id)
      .single();

    const existingNotes = existing?.notes || "";
    updateData.notes = existingNotes
      ? `${existingNotes}\n\n--- Sign-off Notes ---\n${validation.data.notes}`
      : `--- Sign-off Notes ---\n${validation.data.notes}`;
  }

  const { data, error } = await service
    .from("observations")
    .update(updateData)
    .eq("id", id)
    .select(`
      *,
      template:observation_templates(id, name),
      observer:users!observations_observer_id_fkey(id, first_name, last_name),
      subject:users!observations_subject_id_fkey(id, first_name, last_name),
      sign_off_user:users!observations_sign_off_by_fkey(id, first_name, last_name)
    `)
    .single();

  if (error) {
    console.error("Observation sign-off error:", error.message);
    return NextResponse.json({ error: "Failed to sign off observation" }, { status: 500 });
  }

  return NextResponse.json({ observation: data });
}
