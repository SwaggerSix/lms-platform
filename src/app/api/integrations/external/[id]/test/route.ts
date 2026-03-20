import { authorize } from "@/lib/auth/authorize";
import { createServiceClient } from "@/lib/supabase/service";
import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { hrisSync } from "@/lib/integrations/hris-sync";
import { crmSync } from "@/lib/integrations/crm-sync";

/**
 * POST /api/integrations/external/[id]/test
 *
 * Tests the connection for an external integration (HRIS, CRM, etc.)
 * without performing a full sync. Returns success/failure and a message.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorize("admin");
  if (!auth.authorized)
    return NextResponse.json({ error: auth.error }, { status: auth.status });

  const rl = await rateLimit(`integration-test-${auth.user.id}`, 10, 60000);
  if (!rl.success)
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });

  const { id } = await params;
  const service = createServiceClient();

  const { data: integration, error } = await service
    .from("external_integrations")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !integration) {
    return NextResponse.json(
      { error: "Integration not found" },
      { status: 404 }
    );
  }

  try {
    let result: { success: boolean; message: string };

    if (integration.type === "crm") {
      result = await crmSync.testConnection(id);
    } else {
      // HRIS and all other types
      result = await hrisSync.testConnection(id);
    }

    return NextResponse.json({
      success: result.success,
      message: result.message,
      provider: integration.provider,
      type: integration.type,
    });
  } catch (err) {
    console.error("Integration test connection error:", err);
    return NextResponse.json(
      {
        success: false,
        message:
          err instanceof Error ? err.message : "Connection test failed",
      },
      { status: 500 }
    );
  }
}
