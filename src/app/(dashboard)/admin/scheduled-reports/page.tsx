import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ScheduledReportsClient from "./scheduled-reports-client";
import type { ScheduledReportWithHistory } from "./scheduled-reports-client";

export default async function ScheduledReportsPage() {
  const supabase = await createClient();

  // ── Auth ──
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Look up internal user by auth_id
  const { data: dbUser } = await supabase
    .from("users")
    .select("id")
    .eq("auth_id", user.id)
    .single();

  if (!dbUser) {
    redirect("/login");
  }

  // ── Fetch scheduled reports with creator join ──
  const { data: reportsRaw } = await supabase
    .from("scheduled_reports")
    .select(`
      *,
      creator:users!scheduled_reports_created_by_fkey(
        id,
        first_name,
        last_name,
        email
      )
    `)
    .order("created_at", { ascending: false });

  // ── Map to client shape ──
  const reports: ScheduledReportWithHistory[] = (reportsRaw ?? []).map((r: any) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    report_type: r.report_type,
    filters: r.filters ?? {},
    schedule_frequency: r.schedule_frequency,
    schedule_day: r.schedule_day,
    schedule_time: r.schedule_time,
    schedule_timezone: r.schedule_timezone,
    delivery_method: r.delivery_method,
    recipients: r.recipients ?? [],
    format: r.format,
    is_active: r.is_active,
    last_run_at: r.last_run_at,
    next_run_at: r.next_run_at,
    created_by: r.created_by,
    created_at: r.created_at,
    updated_at: r.updated_at,
    creator: r.creator ?? null,
    // Run history not yet stored in DB; provide empty array for now
    runHistory: [],
  }));

  return <ScheduledReportsClient initialReports={reports} />;
}
