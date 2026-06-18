import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { rateLimit } from "@/lib/rate-limit";
import {
  bearerFromHeader,
  verifyBridgeToken,
  clampLimit,
  leasePendingEvents,
} from "@/lib/integrations/qb-bridge";

// Machine-to-machine pull endpoint. The QB Bridge authenticates with the
// QB_BRIDGE_TOKEN bearer token (timing-safe compared) and leases queued
// events. The bearer token is the security boundary; we deliberately use the
// service-role client (RLS bypassed) — these are not user-callable routes.
export const dynamic = "force-dynamic";

function clientIp(request: NextRequest): string {
  const fwd = request.headers.get("x-forwarded-for");
  return fwd?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
}

export async function GET(request: NextRequest) {
  const rl = await rateLimit(`qb-bridge-pending:${clientIp(request)}`, 60, 60_000);
  if (!rl.success) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const token = bearerFromHeader(request.headers.get("authorization"));
  if (!verifyBridgeToken(token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limit = clampLimit(request.nextUrl.searchParams.get("limit"));

  try {
    const service = createServiceClient();
    const events = await leasePendingEvents(service, limit);
    return NextResponse.json({ events });
  } catch (err) {
    console.error("[qb-bridge pending]", err);
    return NextResponse.json({ error: "Failed to lease events" }, { status: 500 });
  }
}
