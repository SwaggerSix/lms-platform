import { authorize } from "@/lib/auth/authorize";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { validateBody, updateNudgeAssignmentSchema } from "@/lib/validations";

async function loadOwned(service: ReturnType<typeof createServiceClient>, id: string) {
  const { data } = await service.from("nudge_assignments").select("id, assigned_by").eq("id", id).single();
  return data;
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorize("manager", "admin", "super_admin");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const validation = validateBody(updateNudgeAssignmentSchema, body);
  if (!validation.success) return NextResponse.json({ error: validation.error }, { status: 400 });

  const service = createServiceClient();
  const assignment = await loadOwned(service, id);
  if (!assignment) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const isAdmin = ["admin", "super_admin"].includes(auth.user.role);
  if (!isAdmin && assignment.assigned_by !== auth.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await service
    .from("nudge_assignments")
    .update(validation.data)
    .eq("id", id)
    .select()
    .single();
  if (error) {
    console.error("Nudge assignment PATCH error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
  return NextResponse.json(data);
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorize("manager", "admin", "super_admin");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const service = createServiceClient();
  const assignment = await loadOwned(service, id);
  if (!assignment) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const isAdmin = ["admin", "super_admin"].includes(auth.user.role);
  if (!isAdmin && assignment.assigned_by !== auth.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error } = await service.from("nudge_assignments").delete().eq("id", id);
  if (error) {
    console.error("Nudge assignment DELETE error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
