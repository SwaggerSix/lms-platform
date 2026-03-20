import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/auth/authorize";
import {
  sendTeamsNotification,
  testNotificationCard,
} from "@/lib/integrations/teams/notifications";

/**
 * POST /api/teams/test-webhook
 * Send a test message to a Teams channel webhook URL.
 */
export async function POST(request: NextRequest) {
  const auth = await authorize("admin");
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { webhookUrl } = body;
  if (!webhookUrl || typeof webhookUrl !== "string") {
    return NextResponse.json(
      { error: "webhookUrl is required" },
      { status: 400 }
    );
  }

  // Basic URL validation
  try {
    new URL(webhookUrl);
  } catch {
    return NextResponse.json(
      { error: "Invalid webhook URL" },
      { status: 400 }
    );
  }

  const card = testNotificationCard();
  const result = await sendTeamsNotification(webhookUrl, card);

  if (result.success) {
    return NextResponse.json({ success: true, message: "Test message sent successfully" });
  }

  return NextResponse.json(
    { success: false, error: result.error || "Failed to send test message" },
    { status: 502 }
  );
}
