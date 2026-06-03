import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { syncSharePointRosters } from "@/lib/integrations/sharepoint-rosters/sync";

// Vercel Cron: imports attendee rosters from SharePoint into ilt_attendance.
// Scheduled to run after the GEMS sync, so the GEMS-sourced ilt_sessions
// already exist before we try to attach attendees to them.
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return handler(request);
}
export async function POST(request: NextRequest) {
  return handler(request);
}

async function handler(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const service = createServiceClient();
  const { data: integrations, error } = await service
    .from("external_integrations")
    .select("id")
    .eq("provider", "sharepoint_rosters")
    .eq("is_active", true);

  if (error) {
    console.error("Cron sharepoint-roster-sync: failed to list integrations", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  const results: Array<{ integration_id: string; ok: boolean; error?: string }> = [];
  for (const integration of integrations ?? []) {
    try {
      await syncSharePointRosters(integration.id);
      results.push({ integration_id: integration.id, ok: true });
    } catch (err) {
      results.push({
        integration_id: integration.id,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return NextResponse.json({
    message: "SharePoint roster sync processed",
    integrations_processed: results.length,
    results,
  });
}
