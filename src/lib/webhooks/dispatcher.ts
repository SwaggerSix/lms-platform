import { createClient } from "@/lib/supabase/server";

export type WebhookEvent =
  | "enrollment.created"
  | "enrollment.completed"
  | "course.created"
  | "course.updated"
  | "assessment.submitted"
  | "certificate.issued"
  | "user.created"
  | "badge.earned";

async function generateSignature(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  const hex = Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, "0")).join("");
  const timestamp = Math.floor(Date.now() / 1000);
  return `t=${timestamp},v1=${hex}`;
}

export async function dispatchWebhook(event: WebhookEvent, payload: Record<string, any>) {
  try {
    // Fetch webhook config from platform_settings
    const supabase = await createClient();
    const { data: setting } = await supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "webhooks")
      .single();

    if (!setting?.value) return;

    const config = setting.value as { webhookUrl?: string; webhookSecret?: string; selectedWebhookEvents?: string[] };
    if (!config.webhookUrl) return;

    // Check if this event type is enabled
    if (config.selectedWebhookEvents && !config.selectedWebhookEvents.includes(event)) return;

    const secret = config.webhookSecret || process.env.WEBHOOK_SECRET || "default-webhook-secret";

    // Fire the webhook (non-blocking)
    const webhookPayload = {
      event,
      timestamp: new Date().toISOString(),
      data: payload,
    };

    const payloadString = JSON.stringify(webhookPayload);
    const signature = await generateSignature(payloadString, secret);

    await fetch(config.webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Event": event,
        "X-Webhook-Signature": signature,
      },
      body: payloadString,
      signal: AbortSignal.timeout(10000), // 10s timeout
    }).catch(err => {
      console.error(`Webhook delivery failed for ${event}:`, err.message);
    });
  } catch (err) {
    // Never let webhook failures break the main flow
    console.error("Webhook dispatch error:", err);
  }
}
