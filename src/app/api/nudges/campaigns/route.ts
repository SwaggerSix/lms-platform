import { authorize } from "@/lib/auth/authorize";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { validateBody, createNudgeCampaignSchema } from "@/lib/validations";
import { rateLimit } from "@/lib/rate-limit";

// GET: list campaigns with enrollment counts.
export async function GET(_request: NextRequest) {
  const auth = await authorize("manager", "admin", "super_admin");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const service = createServiceClient();
  const isAdmin = ["admin", "super_admin"].includes(auth.user.role);

  let query = service.from("nudge_campaigns").select("*").order("created_at", { ascending: false });
  if (!isAdmin) query = query.eq("created_by", auth.user.id);

  const { data: campaigns, error } = await query;
  if (error) {
    console.error("Nudge campaigns GET error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  const list = campaigns ?? [];
  if (list.length > 0) {
    const ids = list.map((c) => c.id);
    const { data: enrollments } = await service
      .from("nudge_campaign_enrollments")
      .select("campaign_id, status")
      .in("campaign_id", ids);
    for (const c of list as Array<Record<string, unknown> & { id: string }>) {
      const mine = (enrollments ?? []).filter((e) => e.campaign_id === c.id);
      c.enrolledCount = mine.length;
      c.completedCount = mine.filter((e) => e.status === "completed").length;
    }
  }
  return NextResponse.json({ campaigns: list });
}

// POST: create a campaign and its ordered items.
export async function POST(request: NextRequest) {
  const auth = await authorize("manager", "admin", "super_admin");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const rl = await rateLimit(`nudge-campaign-create-${auth.user.id}`, 20, 60000);
  if (!rl.success) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });

  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const validation = validateBody(createNudgeCampaignSchema, body);
  if (!validation.success) return NextResponse.json({ error: validation.error }, { status: 400 });
  const input = validation.data;

  const service = createServiceClient();
  const { data: me } = await service.from("users").select("organization_id").eq("id", auth.user.id).single();

  const { data: campaign, error } = await service
    .from("nudge_campaigns")
    .insert({
      organization_id: me?.organization_id ?? null,
      created_by: auth.user.id,
      name: input.name,
      category: input.category,
      frequency: input.frequency,
      frequency_days: input.frequency_days ?? null,
      send_morning_email: input.send_morning_email,
      send_morning_sms: input.send_morning_sms,
      send_evening_email: input.send_evening_email,
      send_evening_sms: input.send_evening_sms,
      morning_send_time: input.morning_send_time,
      evening_send_time: input.evening_send_time,
      timezone: input.timezone,
      total_nudges: input.action_ids.length,
    })
    .select()
    .single();
  if (error) {
    console.error("Nudge campaign POST error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  const items = input.action_ids.map((actionId, i) => ({
    campaign_id: campaign.id,
    nudge_action_id: actionId,
    position: i + 1,
  }));
  const { error: itemsError } = await service.from("nudge_campaign_items").insert(items);
  if (itemsError) {
    await service.from("nudge_campaigns").delete().eq("id", campaign.id);
    console.error("Nudge campaign items error:", itemsError.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json(campaign, { status: 201 });
}
