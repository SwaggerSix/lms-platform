import { authorize } from "@/lib/auth/authorize";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { logAudit } from "@/lib/audit";
import { z } from "zod";

const updateSchema = z.object({
  first_name: z.string().min(1).max(100).optional(),
  last_name: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  job_title: z.string().max(200).optional().nullable(),
  status: z.enum(["active", "inactive", "suspended"]).optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorize("admin", "manager");
  if (!auth.authorized)
    return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const validation = updateSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { error: validation.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const service = createServiceClient();
  const { id } = await params;

  // Only allow editing members that belong to the caller's team.
  const { data: member, error: fetchError } = await service
    .from("users")
    .select("id, manager_id")
    .eq("id", id)
    .single();

  if (fetchError || !member) {
    return NextResponse.json({ error: "Team member not found" }, { status: 404 });
  }
  if (member.manager_id !== auth.user.id) {
    return NextResponse.json(
      { error: "You can only edit members of your own team" },
      { status: 403 }
    );
  }

  const { data, error } = await service
    .from("users")
    .update(validation.data)
    .eq("id", id)
    .select("id, first_name, last_name, email, job_title, status")
    .single();

  if (error) {
    console.error("Team member update error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  logAudit({
    userId: auth.user.id,
    action: "updated",
    entityType: "user",
    entityId: id,
    newValues: validation.data,
  });

  return NextResponse.json(data);
}
