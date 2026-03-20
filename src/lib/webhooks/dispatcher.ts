import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { dispatchTeamsNotification } from "@/lib/webhooks/teams-bridge";

export type WebhookEvent =
  | "enrollment.created"
  | "enrollment.completed"
  | "course.created"
  | "course.updated"
  | "assessment.submitted"
  | "certificate.issued"
  | "user.created"
  | "badge.earned";

// Retry backoff schedule in seconds: 1min, 5min, 30min, then give up
const RETRY_DELAYS_SEC = [60, 300, 1800];

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

/**
 * Dispatch a webhook event. Logs every attempt to webhook_deliveries
 * and schedules retries on failure with exponential backoff.
 */
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

    const secret = config.webhookSecret || process.env.WEBHOOK_SECRET;
    if (!secret) {
      console.error("Webhook secret not configured -- skipping dispatch");
      return;
    }

    const webhookPayload = {
      event,
      timestamp: new Date().toISOString(),
      data: payload,
    };

    const payloadString = JSON.stringify(webhookPayload);

    // Create delivery record
    const service = createServiceClient();
    const { data: delivery, error: insertError } = await service
      .from("webhook_deliveries")
      .insert({
        event_type: event,
        payload: webhookPayload,
        target_url: config.webhookUrl,
        status: "pending",
        attempts: 0,
        max_attempts: RETRY_DELAYS_SEC.length + 1, // initial + retries
      })
      .select("id")
      .single();

    if (insertError) {
      // Table might not exist yet -- fall back to fire-and-forget
      console.warn("webhook_deliveries table not available:", insertError.message);
      await fireWebhook(config.webhookUrl, event, payloadString, secret);
      return;
    }

    // Attempt delivery
    await attemptDelivery(
      service,
      delivery.id,
      config.webhookUrl,
      event,
      payloadString,
      secret
    );
  } catch (err) {
    // Never let webhook failures break the main flow
    console.error("Webhook dispatch error:", err);
  }

  // Also send to Teams channel if configured (fire-and-forget)
  dispatchTeamsNotification(event, payload).catch((err) => {
    console.error("Teams notification dispatch error:", err);
  });
}

/**
 * Attempt to deliver a webhook. Updates the delivery record with the result.
 */
async function attemptDelivery(
  service: ReturnType<typeof createServiceClient>,
  deliveryId: string,
  targetUrl: string,
  event: string,
  payloadString: string,
  secret: string
) {
  const now = new Date().toISOString();

  try {
    const signature = await generateSignature(payloadString, secret);

    const response = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Event": event,
        "X-Webhook-Signature": signature,
      },
      body: payloadString,
      signal: AbortSignal.timeout(10000), // 10s timeout
    });

    // Read response body (truncated)
    let responseBody = "";
    try {
      responseBody = (await response.text()).slice(0, 2000);
    } catch {
      // ignore read errors
    }

    if (response.ok) {
      // Delivered successfully -- re-fetch current attempts for accurate count
      const { data: current } = await service
        .from("webhook_deliveries")
        .select("attempts")
        .eq("id", deliveryId)
        .single();

      await service
        .from("webhook_deliveries")
        .update({
          status: "delivered",
          attempts: (current?.attempts ?? 0) + 1,
          last_attempt_at: now,
          response_status: response.status,
          response_body: responseBody,
          next_retry_at: null,
        })
        .eq("id", deliveryId);
    } else {
      await handleFailure(service, deliveryId, response.status, responseBody);
    }
  } catch (err: any) {
    await handleFailure(service, deliveryId, null, err.message?.slice(0, 2000) || "Network error");
  }
}

/**
 * Handle a failed delivery attempt: increment attempts and schedule retry
 * or mark as permanently failed.
 */
async function handleFailure(
  service: ReturnType<typeof createServiceClient>,
  deliveryId: string,
  responseStatus: number | null,
  responseBody: string
) {
  const now = new Date();

  // Get current state
  const { data: delivery } = await service
    .from("webhook_deliveries")
    .select("attempts, max_attempts")
    .eq("id", deliveryId)
    .single();

  if (!delivery) return;

  const newAttempts = delivery.attempts + 1;
  const retryIndex = newAttempts - 1; // 0-indexed into RETRY_DELAYS_SEC

  if (retryIndex < RETRY_DELAYS_SEC.length) {
    // Schedule retry with exponential backoff
    const delaySec = RETRY_DELAYS_SEC[retryIndex];
    const nextRetry = new Date(now.getTime() + delaySec * 1000);

    await service
      .from("webhook_deliveries")
      .update({
        status: "retrying",
        attempts: newAttempts,
        last_attempt_at: now.toISOString(),
        next_retry_at: nextRetry.toISOString(),
        response_status: responseStatus,
        response_body: responseBody,
      })
      .eq("id", deliveryId);

    console.warn(
      `Webhook delivery ${deliveryId} failed (attempt ${newAttempts}). ` +
      `Retrying in ${delaySec}s at ${nextRetry.toISOString()}`
    );
  } else {
    // Max attempts reached -- mark as permanently failed
    await service
      .from("webhook_deliveries")
      .update({
        status: "failed",
        attempts: newAttempts,
        last_attempt_at: now.toISOString(),
        next_retry_at: null,
        response_status: responseStatus,
        response_body: responseBody,
      })
      .eq("id", deliveryId);

    console.error(
      `Webhook delivery ${deliveryId} permanently failed after ${newAttempts} attempts.`
    );
  }
}

/**
 * Process all pending retries. Should be called by a cron job.
 * Fetches deliveries with status='retrying' whose next_retry_at <= now,
 * and re-attempts each one.
 */
export async function processRetries() {
  const service = createServiceClient();

  const { data: pendingRetries, error } = await service
    .from("webhook_deliveries")
    .select("id, event_type, payload, target_url")
    .eq("status", "retrying")
    .lte("next_retry_at", new Date().toISOString())
    .order("next_retry_at", { ascending: true })
    .limit(50);

  if (error) {
    console.error("Failed to fetch webhook retries:", error.message);
    return { processed: 0, errors: [error.message] };
  }

  if (!pendingRetries || pendingRetries.length === 0) {
    return { processed: 0, errors: [] };
  }

  // Get webhook secret
  const { data: setting } = await service
    .from("platform_settings")
    .select("value")
    .eq("key", "webhooks")
    .single();

  const config = setting?.value as { webhookSecret?: string } | undefined;
  const secret = config?.webhookSecret || process.env.WEBHOOK_SECRET;

  if (!secret) {
    console.error("Webhook secret not configured -- cannot process retries");
    return { processed: 0, errors: ["Webhook secret not configured"] };
  }

  let processed = 0;
  const errors: string[] = [];

  for (const delivery of pendingRetries) {
    try {
      const payloadString = JSON.stringify(delivery.payload);
      await attemptDelivery(
        service,
        delivery.id,
        delivery.target_url,
        delivery.event_type,
        payloadString,
        secret
      );
      processed++;
    } catch (err: any) {
      errors.push(`${delivery.id}: ${err.message}`);
    }
  }

  console.log(`Processed ${processed} webhook retries. Errors: ${errors.length}`);
  return { processed, errors };
}

// ---- Internal helpers ----

/** Fire-and-forget webhook (fallback when delivery table is unavailable). */
async function fireWebhook(url: string, event: string, payload: string, secret: string) {
  try {
    const signature = await generateSignature(payload, secret);
    await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Event": event,
        "X-Webhook-Signature": signature,
      },
      body: payload,
      signal: AbortSignal.timeout(10000),
    });
  } catch (err: any) {
    console.error(`Webhook delivery failed for ${event}:`, err.message);
  }
}

