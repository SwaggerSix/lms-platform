import { authorize } from "@/lib/auth/authorize";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { validateBody, createNominationSchema } from "@/lib/validations";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorize();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const service = createServiceClient();

  const { data, error } = await service
    .from("feedback_nominations")
    .select(`
      *,
      subject:users!feedback_nominations_subject_id_fkey(id, first_name, last_name, email),
      reviewer:users!feedback_nominations_reviewer_id_fkey(id, first_name, last_name, email),
      responses:feedback_responses(id, is_draft, submitted_at)
    `)
    .eq("cycle_id", id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Nominations GET error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ nominations: data });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorize("admin", "manager");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Support bulk nominations
  const nominations = Array.isArray(body) ? body : [body];
  const results = [];
  const errors = [];

  const service = createServiceClient();

  for (const nom of nominations) {
    const validation = validateBody(createNominationSchema, nom);
    if (!validation.success) {
      errors.push({ input: nom, error: validation.error });
      continue;
    }

    const { data, error } = await service
      .from("feedback_nominations")
      .insert({
        cycle_id: id,
        ...validation.data,
        nominated_by: auth.user.id,
      })
      .select()
      .single();

    if (error) {
      errors.push({ input: nom, error: error.message });
    } else {
      results.push(data);
    }
  }

  return NextResponse.json({ created: results, errors }, { status: results.length > 0 ? 201 : 400 });
}
