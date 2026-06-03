import { authorize } from "@/lib/auth/authorize";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

async function loadCampaign(service: ReturnType<typeof createServiceClient>, id: string) {
  const { data } = await service.from("nudge_campaigns").select("id, created_by").eq("id", id).single();
  return data;
}

// GET: a campaign with its items and enrollments.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorize("manager", "admin", "super_admin");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const service = createServiceClient();

  const [campaignRes, itemsRes, enrollmentsRes] = await Promise.all([
    service.from("nudge_campaigns").select("*").eq("id", id).single(),
    service.from("nudge_campaign_items").select("*, nudge_actions(title, image_url)").eq("campaign_id", id).order("position"),
    service.from("nudge_campaign_enrollments").select("*").eq("campaign_id", id).order("created_at"),
  ]);

  if (campaignRes.error || !campaignRes.data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const isAdmin = ["admin", "super_admin"].includes(auth.user.role);
  const isGlobal = campaignRes.data.created_by === null;
  if (!isAdmin && !isGlobal && campaignRes.data.created_by !== auth.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const enrollments = enrollmentsRes.data ?? [];
  return NextResponse.json({
    campaign: {
      ...campaignRes.data,
      enrolledCount: enrollments.length,
      completedCount: enrollments.filter((e) => e.status === "completed").length,
    },
    items: itemsRes.data ?? [],
    enrollments,
  });
}

// DELETE: remove a campaign (linked assignments are completed first).
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorize("manager", "admin", "super_admin");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const service = createServiceClient();
  const campaign = await loadCampaign(service, id);
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const isAdmin = ["admin", "super_admin"].includes(auth.user.role);
  if (!isAdmin && campaign.created_by !== auth.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await service.from("nudge_assignments").update({ status: "completed" }).eq("campaign_id", id);
  const { error } = await service.from("nudge_campaigns").delete().eq("id", id);
  if (error) {
    console.error("Nudge campaign DELETE error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
