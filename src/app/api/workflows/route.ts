import { authorize } from "@/lib/auth/authorize";
import { createServiceClient } from "@/lib/supabase/service";
import { validateBody, createWorkflowSchema } from "@/lib/validations";
import { logAudit } from "@/lib/audit";
import { rateLimit } from "@/lib/rate-limit";
import { NextRequest, NextResponse } from "next/server";

// GET: List all workflows (admin only)
export async function GET(request: NextRequest) {
  const auth = await authorize("admin");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const service = createServiceClient();
  const { searchParams } = new URL(request.url);
  const triggerType = searchParams.get("trigger_type");
  const isActive = searchParams.get("is_active");

  let query = service
    .from("workflows")
    .select("*")
    .order("created_at", { ascending: false });

  if (triggerType) query = query.eq("trigger_type", triggerType);
  if (isActive !== null && isActive !== undefined && isActive !== "") {
    query = query.eq("is_active", isActive === "true");
  }

  const { data, error } = await query;

  if (error) {
    console.error("Workflows API error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ workflows: data ?? [] });
}

// POST: Create a new workflow (admin only)
export async function POST(request: NextRequest) {
  const auth = await authorize("admin");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const rl = await rateLimit(`workflow-create-${auth.user.id}`, 20, 60000);
  if (!rl.success) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const validation = validateBody(createWorkflowSchema, body);
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const service = createServiceClient();
  const { data, error } = await service
    .from("workflows")
    .insert({
      name: validation.data.name,
      description: validation.data.description ?? null,
      trigger_type: validation.data.trigger_type,
      trigger_config: validation.data.trigger_config,
      is_active: validation.data.is_active,
      created_by: auth.user.id,
    })
    .select()
    .single();

  if (error) {
    console.error("Workflows API error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  logAudit({
    userId: auth.user.id,
    action: "created",
    entityType: "workflow",
    entityId: data.id,
    newValues: { name: data.name, trigger_type: data.trigger_type },
  });

  return NextResponse.json(data, { status: 201 });
}
