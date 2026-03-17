import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { authorize } from "@/lib/auth/authorize";

/**
 * GET /api/scheduled-reports
 */
export async function GET() {
  const auth = await authorize("admin");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("scheduled_reports")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Scheduled reports API error:", error.message);
    return NextResponse.json({ error: "An internal error occurred" }, { status: 500 });
  }

  const reports = data ?? [];

  return NextResponse.json({
    scheduled_reports: reports,
    total: reports.length,
    active_count: reports.filter((r) => r.is_active).length,
  });
}

/**
 * POST /api/scheduled-reports
 * Create a new scheduled report
 */
export async function POST(request: NextRequest) {
  const auth = await authorize("admin");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabase = await createClient();
  const body = await request.json();

  const { data, error } = await supabase
    .from("scheduled_reports")
    .insert({
      name: body.name,
      description: body.description || null,
      report_type: body.report_type,
      filters: body.filters || {},
      schedule_frequency: body.schedule_frequency,
      schedule_day: body.schedule_day ?? null,
      schedule_time: body.schedule_time,
      schedule_timezone: body.schedule_timezone || "America/New_York",
      delivery_method: body.delivery_method || "email",
      recipients: body.recipients || [],
      format: body.format || "pdf",
      is_active: true,
      next_run_at: new Date().toISOString(),
      created_by: body.created_by || null,
    })
    .select()
    .single();

  if (error) {
    console.error("Scheduled reports API error:", error.message);
    return NextResponse.json({ error: "An internal error occurred" }, { status: 500 });
  }

  return NextResponse.json({ scheduled_report: data }, { status: 201 });
}

/**
 * PATCH /api/scheduled-reports
 * Update a scheduled report
 */
export async function PATCH(request: NextRequest) {
  const auth = await authorize("admin");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabase = await createClient();
  const body = await request.json();

  if (!body.id) {
    return NextResponse.json({ error: "Schedule ID is required" }, { status: 400 });
  }

  const { id } = body;
  const allowedFields = ["name", "type", "frequency", "recipients", "filters", "is_active", "next_run_at", "timezone"] as const;
  const updates: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (body[field] !== undefined) updates[field] = body[field];
  }

  const { data, error } = await supabase
    .from("scheduled_reports")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return NextResponse.json({ error: "Scheduled report not found" }, { status: 404 });
    }
    console.error("Scheduled reports API error:", error.message);
    return NextResponse.json({ error: "An internal error occurred" }, { status: 500 });
  }

  return NextResponse.json({ scheduled_report: data });
}

/**
 * DELETE /api/scheduled-reports
 * Delete a scheduled report
 */
export async function DELETE(request: NextRequest) {
  const auth = await authorize("admin");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Schedule ID is required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("scheduled_reports")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Scheduled reports API error:", error.message);
    return NextResponse.json({ error: "An internal error occurred" }, { status: 500 });
  }

  return NextResponse.json({ success: true, deleted_id: id });
}
