import { authorize } from "@/lib/auth/authorize";
import { createServiceClient } from "@/lib/supabase/service";
import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { hrisSync } from "@/lib/integrations/hris-sync";
import { crmSync } from "@/lib/integrations/crm-sync";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorize("admin");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const rl = await rateLimit(`sync-${auth.user.id}`, 5, 60000);
  if (!rl.success) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });

  const { id } = await params;
  const service = createServiceClient();

  const { data: integration, error } = await service
    .from("external_integrations")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !integration) {
    return NextResponse.json({ error: "Integration not found" }, { status: 404 });
  }

  if (!integration.is_active) {
    return NextResponse.json({ error: "Integration is not active" }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const syncType = body.sync_type || "full";

  try {
    let result;

    if (integration.type === "crm") {
      result = await crmSync.syncContacts(id);
    } else {
      result = await hrisSync.syncUsers(id, syncType);
    }

    return NextResponse.json({ result });
  } catch (err) {
    console.error("Sync error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sync failed" },
      { status: 500 }
    );
  }
}
