import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { withCronMonitoring } from "@/lib/cron/monitor";
import { runExpirySweep } from "@/lib/certifications/expiry";

/**
 * Daily: expire certificates past their date and send the 90- and 30-day
 * warnings (src/lib/certifications/expiry.ts). Vercel Cron calls it with the
 * CRON_SECRET bearer; POST is accepted for a manual run.
 */
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return handler(request);
}
export async function POST(request: NextRequest) {
  return handler(request);
}

async function handler(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await withCronMonitoring("certification-expiry", () => runExpirySweep(createServiceClient()));
    return NextResponse.json({ status: "ok", ...result });
  } catch (err) {
    console.error("[certification-expiry]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
