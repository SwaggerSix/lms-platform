import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { rateLimit } from "@/lib/rate-limit";
import {
  bearerFromHeader,
  verifyBridgeToken,
  ackBodySchema,
  applyAckBatch,
} from "@/lib/integrations/qb-bridge";

// Machine-to-machine ack endpoint. The QB Bridge reports the result of posting
// each leased event; we write the QB ids back onto the source rows and the
// entity map. Auth: QB_BRIDGE_TOKEN bearer token (timing-safe). Service-role
// client (RLS bypassed) — the bearer token is the security boundary.
export const dynamic = "force-dynamic";

function clientIp(request: NextRequest): string {
  const fwd = request.headers.get("x-forwarded-for");
  return fwd?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
}

export async function POST(request: NextRequest) {
  const rl = await rateLimit(`qb-bridge-ack:${clientIp(request)}`, 60, 60_000);
  if (!rl.success) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const token = bearerFromHeader(request.headers.get("authorization"));
  if (!verifyBridgeToken(token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = ackBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const service = createServiceClient();
    const updated = await applyAckBatch(service, parsed.data.results);
    return NextResponse.json({ updated });
  } catch (err) {
    console.error("[qb-bridge ack]", err);
    return NextResponse.json({ error: "Failed to apply ack" }, { status: 500 });
  }
}
