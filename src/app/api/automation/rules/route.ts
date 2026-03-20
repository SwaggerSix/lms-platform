import { authorize } from "@/lib/auth/authorize";
import { createServiceClient } from "@/lib/supabase/service";
import { validateBody } from "@/lib/validations";
import { logAudit } from "@/lib/audit";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const ruleActionSchema = z.object({
  type: z.enum(["enroll_course", "enroll_path", "assign_badge", "send_notification"]),
  course_id: z.string().uuid().optional(),
  path_id: z.string().uuid().optional(),
  badge_id: z.string().uuid().optional(),
  due_days: z.number().int().positive().optional(),
  notification_text: z.string().max(1000).optional(),
});

const createRuleSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  is_active: z.boolean().optional(),
  trigger_type: z.enum(["user_created", "role_changed", "org_changed", "hire_date", "manual", "course_completed", "schedule"]),
  conditions: z.object({
    role: z.array(z.string()).optional(),
    organization_id: z.array(z.string().uuid()).optional(),
    hire_date_within_days: z.number().int().min(1).optional(),
    job_title_contains: z.string().optional(),
    completed_course_id: z.string().uuid().optional(),
  }).optional().default({}),
  actions: z.array(ruleActionSchema).min(1),
});

const updateRuleSchema = createRuleSchema.partial();

// GET: List all rules with run stats (admin only)
export async function GET(request: NextRequest) {
  const auth = await authorize("admin");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const service = createServiceClient();
  const { searchParams } = new URL(request.url);
  const triggerType = searchParams.get("trigger_type");
  const isActive = searchParams.get("is_active");

  let query = service
    .from("enrollment_rules")
    .select("*")
    .order("created_at", { ascending: false });

  if (triggerType) query = query.eq("trigger_type", triggerType);
  if (isActive !== null && isActive !== undefined && isActive !== "") {
    query = query.eq("is_active", isActive === "true");
  }

  const { data, error } = await query;

  if (error) {
    console.error("Automation rules API error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ rules: data ?? [] });
}

// POST: Create new rule (admin only)
export async function POST(request: NextRequest) {
  const auth = await authorize("admin");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const validation = validateBody(createRuleSchema, body);
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const service = createServiceClient();
  const { data, error } = await service
    .from("enrollment_rules")
    .insert({
      name: validation.data.name,
      description: validation.data.description ?? null,
      is_active: validation.data.is_active ?? true,
      trigger_type: validation.data.trigger_type,
      conditions: validation.data.conditions,
      actions: validation.data.actions,
      created_by: auth.user.id,
    })
    .select()
    .single();

  if (error) {
    console.error("Automation rules API error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  logAudit({
    userId: auth.user.id,
    action: "created",
    entityType: "enrollment_rule",
    entityId: data.id,
    newValues: { name: data.name, trigger_type: data.trigger_type },
  });

  return NextResponse.json(data, { status: 201 });
}

// PATCH: Update rule (admin only)
export async function PATCH(request: NextRequest) {
  const auth = await authorize("admin");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { id, ...updates } = body;
  if (!id) {
    return NextResponse.json({ error: "Rule id is required" }, { status: 400 });
  }

  const validation = validateBody(updateRuleSchema, updates);
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const service = createServiceClient();
  const updateData: Record<string, unknown> = { ...validation.data, updated_at: new Date().toISOString() };

  const { data, error } = await service
    .from("enrollment_rules")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return NextResponse.json({ error: "Rule not found" }, { status: 404 });
    }
    console.error("Automation rules API error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  logAudit({
    userId: auth.user.id,
    action: "updated",
    entityType: "enrollment_rule",
    entityId: id,
    newValues: validation.data,
  });

  return NextResponse.json(data);
}

// DELETE: Delete rule (admin only)
export async function DELETE(request: NextRequest) {
  const auth = await authorize("admin");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Rule id is required" }, { status: 400 });
  }

  const service = createServiceClient();
  const { error } = await service
    .from("enrollment_rules")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Automation rules API error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  logAudit({
    userId: auth.user.id,
    action: "deleted",
    entityType: "enrollment_rule",
    entityId: id,
  });

  return NextResponse.json({ message: "Rule deleted" });
}
