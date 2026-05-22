import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/auth/authorize";
import {
  sendTeamsNotification,
  testNotificationCard,
} from "@/lib/integrations/teams/notifications";
import { jsonNoStore } from "@/lib/api/no-store";

/**
 * POST /api/teams/test-webhook
 * Send a test message to a Teams channel webhook URL.
 */
export async function POST(request: NextRequest) {
  const auth = await authorize("admin");
  if (!auth.authorized) {
    return jsonNoStore({ error: auth.error }, { status: auth.status });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonNoStore({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { webhookUrl } = body;
  if (!webhookUrl || typeof webhookUrl !== "string") {
    return jsonNoStore(
      { error: "webhookUrl is required" },
      { status: 400 }
    );
  }

  // Basic URL validation
  try {
    new URL(webhookUrl);
  } catch {
    return jsonNoStore(
      { error: "Invalid webhook URL" },
      { status: 400 }
    );
  }

  const card = testNotificationCard();
  const result = await sendTeamsNotification(webhookUrl, card);

  if (result.success) {
    return jsonNoStore({ success: true, message: "Test message sent successfully" });
  }

  return jsonNoStore(
    { success: false, error: result.error || "Failed to send test message" },
    { status: 502 }
  );
}
