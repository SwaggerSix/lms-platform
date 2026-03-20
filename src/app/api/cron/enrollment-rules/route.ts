import { NextRequest, NextResponse } from "next/server";
import { runScheduledRules } from "@/lib/automation/rules-engine";

// Vercel Cron: runs every hour
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return handler(request);
}

export async function POST(request: NextRequest) {
  return handler(request);
}

async function handler(request: NextRequest) {
  // Verify cron secret to prevent unauthorized access
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runScheduledRules();
    return NextResponse.json({
      message: "Scheduled rules processed",
      rules_processed: result.rulesProcessed,
      users_processed: result.usersProcessed,
    });
  } catch (err) {
    console.error("Cron enrollment-rules error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
