import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/auth/authorize";
import { createServiceClient } from "@/lib/supabase/service";
import { getAccessToken } from "@/lib/integrations/gems/auth";
import type { GemsConfig } from "@/lib/integrations/gems/types";

// GET /api/integrations/gems/events-debug?filter=<json>
// Admin diagnostic: posts a filter to GEMS /api/TrainingEvent and echoes the
// raw response shape so we can see why the sync is returning zero events.
//
// Examples:
//   /api/integrations/gems/events-debug
//     (sends empty {} — what an empty filter actually returns)
//   /api/integrations/gems/events-debug?filter={"earliestDate":"2000-01-01","lastDate":"2030-12-31"}
//     (date-only strings)
//   /api/integrations/gems/events-debug?filter={"earliestDate":"2000-01-01T00:00:00","lastDate":"2030-12-31T23:59:59"}
//     (full ISO datetimes)
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await authorize("admin");
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let filter: Record<string, unknown> = {};
  const filterParam = request.nextUrl.searchParams.get("filter");
  if (filterParam) {
    try {
      filter = JSON.parse(filterParam);
    } catch {
      return NextResponse.json({ error: "filter param must be valid JSON" }, { status: 400 });
    }
  }

  const service = createServiceClient();
  const { data: integration } = await service
    .from("external_integrations")
    .select("config, is_active")
    .eq("provider", "gems")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!integration || !integration.is_active) {
    return NextResponse.json({ error: "No active GEMS integration" }, { status: 404 });
  }

  const config = integration.config as unknown as GemsConfig;
  try {
    const token = await getAccessToken(config);
    const url = `${config.api_base.replace(/\/+$/, "")}/api/TrainingEvent`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(filter),
    });
    const text = await res.text();
    let json: unknown = null;
    try {
      json = JSON.parse(text);
    } catch {
      // not JSON
    }
    return NextResponse.json({
      endpoint: url,
      filter_sent: filter,
      http_status: res.status,
      content_type: res.headers.get("content-type"),
      top_level_type: Array.isArray(json)
        ? "array"
        : json && typeof json === "object"
          ? "object"
          : typeof json,
      top_level_keys:
        json && typeof json === "object" && !Array.isArray(json)
          ? Object.keys(json as Record<string, unknown>)
          : null,
      array_length: Array.isArray(json) ? (json as unknown[]).length : null,
      values_length:
        json && typeof json === "object" && !Array.isArray(json)
          ? Array.isArray((json as Record<string, unknown>).$values)
            ? ((json as Record<string, unknown>).$values as unknown[]).length
            : null
          : null,
      raw_preview: text.slice(0, 1500),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 502 }
    );
  }
}
