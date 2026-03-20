import { authorize } from "@/lib/auth/authorize";
import { createServiceClient } from "@/lib/supabase/service";
import { NextRequest, NextResponse } from "next/server";
import { validateBody, updateAlertSchema } from "@/lib/validations";

export async function GET(request: NextRequest) {
  const auth = await authorize();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const service = createServiceClient();
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("user_id") || auth.user.id;
  const unreadOnly = searchParams.get("unread") === "true";

  // Admins/managers can view alerts for any user
  if (userId !== auth.user.id && !["admin", "manager"].includes(auth.user.role as string)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let query = service
    .from("analytics_alerts")
    .select(
      "*, course:courses!analytics_alerts_course_id_fkey(id, title)"
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (unreadOnly) {
    query = query.eq("is_read", false).eq("is_dismissed", false);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Analytics alerts API error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ alerts: data ?? [] });
}

export async function PUT(request: NextRequest) {
  const auth = await authorize();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const alertId = body.id;
  if (!alertId) {
    return NextResponse.json({ error: "Alert id is required" }, { status: 400 });
  }

  const validation = validateBody(updateAlertSchema, body);
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const service = createServiceClient();

  // Verify ownership
  const { data: alert } = await service
    .from("analytics_alerts")
    .select("user_id")
    .eq("id", alertId)
    .single();

  if (!alert) {
    return NextResponse.json({ error: "Alert not found" }, { status: 404 });
  }

  if (alert.user_id !== auth.user.id && auth.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await service
    .from("analytics_alerts")
    .update(validation.data)
    .eq("id", alertId)
    .select()
    .single();

  if (error) {
    console.error("Alert update error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json(data);
}
