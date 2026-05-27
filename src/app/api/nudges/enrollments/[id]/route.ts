import { authorize } from "@/lib/auth/authorize";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

// PATCH: pause or resume a campaign enrollment.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorize("manager", "admin", "super_admin");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  let body: { status?: string };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const status = body.status;
  if (status !== "active" && status !== "paused") {
    return NextResponse.json({ error: "status must be 'active' or 'paused'" }, { status: 400 });
  }

  const service = createServiceClient();
  const { data: enrollment } = await service
    .from("nudge_campaign_enrollments")
    .select("id, campaign_id, current_assignment_id")
    .eq("id", id)
    .single();
  if (!enrollment) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: campaign } = await service
    .from("nudge_campaigns")
    .select("created_by")
    .eq("id", enrollment.campaign_id)
    .single();
  const isAdmin = ["admin", "super_admin"].includes(auth.user.role);
  if (!isAdmin && campaign?.created_by !== auth.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (enrollment.current_assignment_id) {
    await service.from("nudge_assignments").update({ status }).eq("id", enrollment.current_assignment_id);
  }
  await service.from("nudge_campaign_enrollments").update({ status }).eq("id", id);

  return NextResponse.json({ success: true, status });
}
