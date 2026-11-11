import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { withCronMonitoring } from "@/lib/cron/monitor";
import { sendWeeklyDigests } from "@/lib/certifications/digest";

/**
 * Weekly (Monday morning, US Eastern): each member of staff who looks after a
 * certification gets one email listing work waiting to be marked, learners
 * ready to award, and certificates expiring soon
 * (src/lib/certifications/digest.ts). Vercel Cron calls it with the
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
    const result = await withCronMonitoring("certification-digest", () => sendWeeklyDigests(createServiceClient()));
    return NextResponse.json({ status: "ok", ...result });
  } catch (err) {
    console.error("[certification-digest]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
