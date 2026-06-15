import { authorize } from "@/lib/auth/authorize";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { validateBody, createNudgeAssignmentSchema } from "@/lib/validations";
import { rateLimit } from "@/lib/rate-limit";

const SELECT_WITH_ACTION =
  "*, nudge_actions(title, description, estimated_minutes, image_url, quote, quote_author)";

// GET: assignments created by the manager (or all, for admins).
export async function GET(request: NextRequest) {
  const auth = await authorize("instructor", "manager", "admin", "super_admin");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const service = createServiceClient();
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const assigneeId = searchParams.get("assignee_id");

  let query = service
    .from("nudge_assignments")
    .select(SELECT_WITH_ACTION)
    .order("created_at", { ascending: false });

  const isAdmin = ["admin", "super_admin"].includes(auth.user.role);
  if (!isAdmin) query = query.eq("assigned_by", auth.user.id);
  if (status) query = query.eq("status", status);
  if (assigneeId) query = query.eq("assignee_id", assigneeId);

  const { data, error } = await query;
  if (error) {
    console.error("Nudge assignments GET error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
  return NextResponse.json({ assignments: data });
}

// POST: assign a nudge to an employee.
export async function POST(request: NextRequest) {
  const auth = await authorize("instructor", "manager", "admin", "super_admin");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const rl = await rateLimit(`nudge-assign-${auth.user.id}`, 60, 60000);
  if (!rl.success) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });

  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const validation = validateBody(createNudgeAssignmentSchema, body);
  if (!validation.success) return NextResponse.json({ error: validation.error }, { status: 400 });
  const input = validation.data;

  const service = createServiceClient();
  const { data: me } = await service.from("users").select("organization_id").eq("id", auth.user.id).single();

  // If an employee user was selected, snapshot their contact details.
  let assigneeName = input.assignee_name;
  let assigneeEmail = input.assignee_email;
  let assigneePhone = input.assignee_phone ?? "";
  if (input.assignee_id) {
    const { data: emp } = await service
      .from("users")
      .select("first_name, last_name, email")
      .eq("id", input.assignee_id)
      .single();
    if (emp) {
      assigneeName = `${emp.first_name} ${emp.last_name}`.trim();
      assigneeEmail = emp.email;
    }
  }

  const { data, error } = await service
    .from("nudge_assignments")
    .insert({
      organization_id: me?.organization_id ?? null,
      nudge_action_id: input.nudge_action_id,
      assignee_id: input.assignee_id ?? null,
      assigned_by: auth.user.id,
      assignee_name: assigneeName,
      assignee_email: assigneeEmail,
      assignee_phone: assigneePhone,
      send_morning_email: input.send_morning_email,
      send_morning_sms: input.send_morning_sms,
      send_evening_email: input.send_evening_email,
      send_evening_sms: input.send_evening_sms,
      morning_send_time: input.morning_send_time,
      evening_send_time: input.evening_send_time,
      timezone: input.timezone,
      starts_on: input.starts_on || new Date().toISOString().split("T")[0],
      ends_on: input.ends_on || null,
    })
    .select(SELECT_WITH_ACTION)
    .single();

  if (error) {
    console.error("Nudge assignments POST error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
  return NextResponse.json(data, { status: 201 });
}
