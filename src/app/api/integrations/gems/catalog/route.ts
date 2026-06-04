import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/auth/authorize";
import { createServiceClient } from "@/lib/supabase/service";
import { GemsClient } from "@/lib/integrations/gems/client";
import type { GemsConfig } from "@/lib/integrations/gems/types";

// GET /api/integrations/gems/catalog
// Returns the GEMS course catalog (productCode + productDescription) using
// the active GEMS integration's stored credentials. Used by the
// course-mapping admin tool to let an admin tag existing LMS courses with
// their GEMS productCode before the first sync.
export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest) {
  const auth = await authorize("admin");
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const service = createServiceClient();
  const { data: integration, error } = await service
    .from("external_integrations")
    .select("id, config, is_active")
    .eq("provider", "gems")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !integration) {
    return NextResponse.json(
      { error: "No GEMS integration configured. Add one under Settings → Integrations." },
      { status: 404 }
    );
  }
  if (!integration.is_active) {
    return NextResponse.json(
      { error: "The GEMS integration exists but is not active. Activate it first." },
      { status: 400 }
    );
  }

  try {
    const client = new GemsClient(integration.config as unknown as GemsConfig);
    const catalog = await client.getCourseProducts();
    const trimmed = catalog
      .map((c) => ({
        course_product_id: c.courseProductId,
        product_code: c.productCode,
        product_description: c.productDescription,
      }))
      .sort((a, b) => a.product_code.localeCompare(b.product_code));
    return NextResponse.json({ catalog: trimmed });
  } catch (err) {
    return NextResponse.json(
      {
        error: `Failed to load GEMS catalog: ${
          err instanceof Error ? err.message : "unknown error"
        }`,
      },
      { status: 502 }
    );
  }
}
