import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const domain = searchParams.get("domain");

  if (!domain) {
    return NextResponse.json({ error: "domain query parameter is required" }, { status: 400 });
  }

  // Normalize domain to lowercase
  const normalizedDomain = domain.toLowerCase().trim();

  const service = createServiceClient();
  const { data, error } = await service
    .from("sso_providers")
    .select("id, name, provider_type")
    .eq("domain", normalizedDomain)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    console.error("SSO check-domain error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ has_sso: false });
  }

  return NextResponse.json({
    has_sso: true,
  });
}
