import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/auth/authorize";
import { createServiceClient } from "@/lib/supabase/service";
import { GemsClient } from "@/lib/integrations/gems/client";
import { getAccessToken } from "@/lib/integrations/gems/auth";
import type { GemsConfig } from "@/lib/integrations/gems/types";

// GET /api/integrations/gems/catalog
// Returns the GEMS course catalog (productCode + productDescription) using
// the active GEMS integration's stored credentials.
//
// Pass ?debug=1 to also return the raw GEMS response (visible only to
// admins) so we can diagnose mismatched response shapes or empty results.
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await authorize("admin");
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const debug = request.nextUrl.searchParams.get("debug") === "1";

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

  const config = integration.config as unknown as GemsConfig;
  try {
    const client = new GemsClient(config);
    const catalog = await client.getCourseProducts();
    const trimmed = catalog
      .map((c) => ({
        course_product_id: c.courseProductId,
        product_code: c.productCode,
        product_description: c.productDescription,
      }))
      .sort((a, b) => a.product_code.localeCompare(b.product_code));

    if (!debug) return NextResponse.json({ catalog: trimmed });

    // Debug mode: also fetch the raw GEMS response so an admin can see
    // exactly what /api/CourseProduct returned (shape + status). The
    // bearer token is never echoed.
    const token = await getAccessToken(config);
    const url = `${config.api_base.replace(/\/+$/, "")}/api/CourseProduct`;
    const rawRes = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
    const rawText = await rawRes.text();
    let rawJson: unknown;
    try {
      rawJson = JSON.parse(rawText);
    } catch {
      rawJson = null;
    }
    return NextResponse.json({
      catalog: trimmed,
      _debug: {
        endpoint: url,
        http_status: rawRes.status,
        content_type: rawRes.headers.get("content-type"),
        raw_top_level_type: Array.isArray(rawJson)
          ? "array"
          : rawJson && typeof rawJson === "object"
            ? "object"
            : typeof rawJson,
        raw_keys:
          rawJson && typeof rawJson === "object" && !Array.isArray(rawJson)
            ? Object.keys(rawJson as Record<string, unknown>)
            : null,
        raw_length: Array.isArray(rawJson) ? (rawJson as unknown[]).length : null,
        raw_sample:
          Array.isArray(rawJson) && (rawJson as unknown[]).length > 0
            ? (rawJson as unknown[]).slice(0, 1)
            : rawJson && typeof rawJson === "object"
              ? rawJson
              : rawText.slice(0, 500),
      },
    });
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
