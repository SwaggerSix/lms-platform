/**
 * Email sending service.
 * Uses the Resend SDK (https://resend.com) for production email delivery.
 * Falls back to console logging in development when RESEND_API_KEY is not set.
 *
 * Usage:
 *   import { sendEmail } from "@/lib/email/sender";
 *   await sendEmail({ to: "user@example.com", subject: "Hello", html: "<p>Hi</p>" });
 *
 * Or use the transport interface for more control:
 *   const sender = getDefaultSender();
 *   await sender.send({ to: "user@example.com", ...template });
 */

import { Resend } from "resend";
import type { EmailTemplate } from "./templates";
import { createServiceClient } from "@/lib/supabase/service";
import { decryptIfEncrypted } from "@/lib/security/secret-crypto";

export interface EmailMessage extends EmailTemplate {
  to: string | string[];
  from?: string;
  replyTo?: string;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface EmailTransport {
  send(message: EmailMessage): Promise<EmailResult>;
}

// ============================================================================
// Resolved email configuration (DB-first, env fallback)
// ============================================================================

// Email settings can be configured in-app (Admin → Email Settings), stored in
// platform_settings[key='email'] as { from, api_key (encrypted) }. We fall back
// to RESEND_API_KEY / EMAIL_FROM env vars. Cached briefly to avoid a DB read
// on every send.
let _cfgCache: { apiKey: string | null; from: string | null; at: number } | null = null;
const CFG_TTL_MS = 30_000;

export function invalidateEmailConfigCache() {
  _cfgCache = null;
}

export async function resolveEmailConfig(): Promise<{ apiKey: string | null; from: string | null }> {
  if (_cfgCache && Date.now() - _cfgCache.at < CFG_TTL_MS) {
    return { apiKey: _cfgCache.apiKey, from: _cfgCache.from };
  }
  let apiKey: string | null = process.env.RESEND_API_KEY || null;
  let from: string | null = process.env.EMAIL_FROM || null;
  try {
    const service = createServiceClient();
    const { data } = await service.from("platform_settings").select("value").eq("key", "email").maybeSingle();
    const v = (data?.value ?? {}) as { api_key?: string; from?: string };
    if (v.api_key) {
      try { apiKey = decryptIfEncrypted(v.api_key); } catch { /* keep env */ }
    }
    if (v.from) from = v.from;
  } catch {
    // DB unavailable — fall back to env.
  }
  _cfgCache = { apiKey, from, at: Date.now() };
  return { apiKey, from };
}

// ============================================================================
// Standalone sendEmail function (recommended)
// ============================================================================

/**
 * Send an email via Resend, using in-app Email Settings if configured, else the
 * RESEND_API_KEY/EMAIL_FROM env vars. If no API key is available, returns a
 * failure (so callers can surface "email not configured"); in development it
 * logs the email and reports success instead.
 */
export async function sendEmail({
  to,
  subject,
  html,
  text,
  from,
  replyTo,
}: {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
}): Promise<{ success: true; id: string } | { success: false; error: string }> {
  const cfg = await resolveEmailConfig();
  const fromAddress = from || cfg.from || "LMS Platform <noreply@example.com>";

  if (!cfg.apiKey) {
    if (process.env.NODE_ENV === "development") {
      console.log("DEV EMAIL (no key configured):", { to, subject, htmlPreview: html.substring(0, 200) });
      return { success: true, id: "dev-mock" };
    }
    return { success: false, error: "Email delivery is not configured" };
  }

  try {
    const { data, error } = await new Resend(cfg.apiKey).emails.send({
      from: fromAddress,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
      ...(text ? { text } : {}),
      ...(replyTo ? { reply_to: replyTo } : {}),
    });

    if (error) {
      throw new Error(error.message);
    }

    return { success: true, id: data?.id ?? "unknown" };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Email send failed:", message);
    return { success: false, error: message };
  }
}

// ============================================================================
// Transport-based providers (for backwards compatibility & flexibility)
// ============================================================================

/**
 * Resend provider using the official SDK
 */
export class ResendTransport implements EmailTransport {
  private resendClient: Resend;
  private from: string;

  constructor(apiKey: string, from: string = "LMS Platform <noreply@example.com>") {
    this.resendClient = new Resend(apiKey);
    this.from = from;
  }

  async send(message: EmailMessage): Promise<EmailResult> {
    try {
      const { data, error } = await this.resendClient.emails.send({
        from: message.from || this.from,
        to: Array.isArray(message.to) ? message.to : [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
        ...(message.replyTo ? { reply_to: message.replyTo } : {}),
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, messageId: data?.id };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }
}

/**
 * SendGrid provider (raw fetch — no extra dependency needed)
 */
export class SendGridTransport implements EmailTransport {
  private apiKey: string;
  private from: string;

  constructor(apiKey: string, from: string = "noreply@learnhub.gov") {
    this.apiKey = apiKey;
    this.from = from;
  }

  async send(message: EmailMessage): Promise<EmailResult> {
    try {
      const to = Array.isArray(message.to) ? message.to : [message.to];
      const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          personalizations: [{ to: to.map((email) => ({ email })) }],
          from: { email: message.from || this.from },
          subject: message.subject,
          content: [
            { type: "text/plain", value: message.text },
            { type: "text/html", value: message.html },
          ],
        }),
      });

      if (!response.ok) {
        return { success: false, error: `SendGrid error: ${response.status}` };
      }

      return { success: true, messageId: response.headers.get("x-message-id") || undefined };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }
}

/**
 * Console transport (for development — logs to console instead of sending)
 */
export class ConsoleTransport implements EmailTransport {
  async send(message: EmailMessage): Promise<EmailResult> {
    console.log("[EMAIL - dev console]", {
      to: message.to,
      subject: message.subject,
      textPreview: message.text.substring(0, 100) + "...",
    });
    return { success: true, messageId: `console-${Date.now()}` };
  }
}

// ============================================================================
// Factory
// ============================================================================

export type EmailProvider = "resend" | "sendgrid" | "console";

interface EmailSenderConfig {
  provider: EmailProvider;
  apiKey?: string;
  from?: string;
}

export function createEmailSender(config: EmailSenderConfig): EmailTransport {
  switch (config.provider) {
    case "resend":
      if (!config.apiKey) throw new Error("Resend API key required");
      return new ResendTransport(config.apiKey, config.from);
    case "sendgrid":
      if (!config.apiKey) throw new Error("SendGrid API key required");
      return new SendGridTransport(config.apiKey, config.from);
    case "console":
    default:
      return new ConsoleTransport();
  }
}

/**
 * Default email sender — auto-selects provider based on env vars.
 *
 * Priority:
 *   1. If RESEND_API_KEY is set, uses Resend SDK
 *   2. If EMAIL_PROVIDER is explicitly set, uses that provider
 *   3. Falls back to console transport in development
 */
export function getDefaultSender(): EmailTransport {
  // Prefer RESEND_API_KEY for zero-config Resend usage
  if (process.env.RESEND_API_KEY) {
    return new ResendTransport(
      process.env.RESEND_API_KEY,
      process.env.EMAIL_FROM
    );
  }

  // Legacy support: check EMAIL_PROVIDER + EMAIL_API_KEY
  const provider = (process.env.EMAIL_PROVIDER || "console") as EmailProvider;
  const apiKey = process.env.EMAIL_API_KEY;
  const from = process.env.EMAIL_FROM;
  return createEmailSender({ provider, apiKey, from });
}
