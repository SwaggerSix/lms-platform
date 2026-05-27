import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { syncGemsEvents } from "@/lib/integrations/gems/sync";

// Vercel Cron: imports GEMS training events into the LMS on a schedule.
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return handler(request);
}

export async function POST(request: NextRequest) {
  return handler(request);
}

async function handler(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const service = createServiceClient();
  const { data: integrations, error } = await service
    .from("external_integrations")
    .select("id")
    .eq("provider", "gems")
    .eq("is_active", true);

  if (error) {
    console.error("Cron gems-sync: failed to list integrations", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  const results: Array<{ integration_id: string; ok: boolean; error?: string }> = [];
  for (const integration of integrations ?? []) {
    try {
      await syncGemsEvents(integration.id);
      results.push({ integration_id: integration.id, ok: true });
    } catch (err) {
      // Per-integration failures are isolated and recorded in
      // integration_sync_logs by syncGemsEvents; keep going.
      results.push({
        integration_id: integration.id,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return NextResponse.json({
    message: "GEMS sync processed",
    integrations_processed: results.length,
    results,
  });
}
