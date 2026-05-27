import "server-only";

/**
 * Minimal SMS sender backed by Twilio's REST API (no SDK dependency).
 *
 * Configure with env vars:
 *   TWILIO_ACCOUNT_SID
 *   TWILIO_AUTH_TOKEN
 *   TWILIO_FROM_NUMBER   (E.164, e.g. +15551234567)
 *
 * When credentials are absent the call resolves with status "skipped"
 * rather than throwing, so the nudge cron can run in environments
 * without SMS configured.
 */

export interface SmsResult {
  status: "sent" | "failed" | "skipped";
  sid: string;
  error?: string;
}

export async function sendSms(to: string, body: string): Promise<SmsResult> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;

  if (!sid || !token || !from) {
    return { status: "skipped", sid: "", error: "SMS not configured" };
  }
  if (!to) {
    return { status: "skipped", sid: "", error: "No phone number" };
  }

  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ To: to, From: from, Body: body }).toString(),
      }
    );

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { status: "failed", sid: "", error: `Twilio ${res.status}: ${text.slice(0, 200)}` };
    }

    const data = (await res.json()) as { sid?: string };
    return { status: "sent", sid: data.sid ?? "" };
  } catch (err) {
    return { status: "failed", sid: "", error: err instanceof Error ? err.message : "Unknown SMS error" };
  }
}
