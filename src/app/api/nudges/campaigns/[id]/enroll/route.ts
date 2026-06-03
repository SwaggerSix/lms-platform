import { authorize } from "@/lib/auth/authorize";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { validateBody, enrollNudgeCampaignSchema } from "@/lib/validations";

// POST: enroll an employee in a campaign, creating the first assignment.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorize("manager", "admin", "super_admin");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id: campaignId } = await params;
  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const validation = validateBody(enrollNudgeCampaignSchema, body);
  if (!validation.success) return NextResponse.json({ error: validation.error }, { status: 400 });
  const input = validation.data;

  const service = createServiceClient();

  const { data: campaign } = await service.from("nudge_campaigns").select("*").eq("id", campaignId).single();
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const isAdmin = ["admin", "super_admin"].includes(auth.user.role);
  const isGlobal = campaign.created_by === null;
  if (!isAdmin && !isGlobal && campaign.created_by !== auth.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: firstItem } = await service
    .from("nudge_campaign_items")
    .select("nudge_action_id")
    .eq("campaign_id", campaignId)
    .eq("position", 1)
    .single();
  if (!firstItem) return NextResponse.json({ error: "Campaign has no actions" }, { status: 400 });

  // Snapshot employee contact details when a user was selected.
  let assigneeName = input.assignee_name;
  let assigneeEmail = input.assignee_email;
  const assigneePhone = input.assignee_phone ?? "";
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

  const today = new Date().toISOString().split("T")[0];
  const { data: me } = await service.from("users").select("organization_id").eq("id", auth.user.id).single();
  const effectiveOrgId = campaign.organization_id ?? me?.organization_id ?? null;

  const { data: assignment, error: aErr } = await service
    .from("nudge_assignments")
    .insert({
      organization_id: effectiveOrgId,
      nudge_action_id: firstItem.nudge_action_id,
      assignee_id: input.assignee_id ?? null,
      assigned_by: auth.user.id,
      assignee_name: assigneeName,
      assignee_email: assigneeEmail,
      assignee_phone: assigneePhone,
      status: "active",
      send_morning_email: campaign.send_morning_email,
      send_morning_sms: campaign.send_morning_sms,
      send_evening_email: campaign.send_evening_email,
      send_evening_sms: campaign.send_evening_sms,
      morning_send_time: campaign.morning_send_time,
      evening_send_time: campaign.evening_send_time,
      timezone: campaign.timezone,
      starts_on: today,
      campaign_id: campaignId,
      campaign_position: 1,
    })
    .select()
    .single();
  if (aErr) {
    console.error("Campaign enroll assignment error:", aErr.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  const { data: enrollment, error: eErr } = await service
    .from("nudge_campaign_enrollments")
    .insert({
      campaign_id: campaignId,
      assignee_id: input.assignee_id ?? null,
      assignee_name: assigneeName,
      assignee_email: assigneeEmail,
      assignee_phone: assigneePhone,
      current_position: 1,
      current_assignment_id: assignment.id,
    })
    .select()
    .single();
  if (eErr) {
    console.error("Campaign enroll error:", eErr.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  await service
    .from("nudge_assignments")
    .update({ campaign_enrollment_id: enrollment.id })
    .eq("id", assignment.id);

  return NextResponse.json(enrollment, { status: 201 });
}
