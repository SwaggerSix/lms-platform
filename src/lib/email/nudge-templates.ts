/**
 * Branded HTML for nudge commitment (morning) and check-in (evening) emails.
 * Ported from the coaching platform; branding pulls from defaultBranding.
 */
import { defaultBranding } from "@/lib/branding";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://example.com";

function esc(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function proxyImage(imageUrl?: string): string | undefined {
  if (!imageUrl) return undefined;
  return imageUrl.endsWith(".webp")
    ? `${APP_URL}/api/image-proxy?url=${encodeURIComponent(imageUrl)}`
    : imageUrl;
}

const brandColor = defaultBranding.primaryColor;
const brandName = defaultBranding.portalName;
const tagline = defaultBranding.tagline;

export function buildMorningNudgeEmail(
  assigneeName: string,
  actionTitle: string,
  actionDescription: string,
  estimatedMinutes: number,
  commitUrl: string,
  imageUrl?: string,
  quote?: string,
  quoteAuthor?: string,
  swapUrl?: string
): string {
  const firstName = esc(assigneeName.split(" ")[0] || assigneeName);
  const img = proxyImage(imageUrl);

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
        <tr>
          <td style="background-color:${brandColor};padding:28px 40px;text-align:center;">
            <span style="font-size:24px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">${esc(brandName)}</span>
          </td>
        </tr>
        <tr>
          <td style="padding:40px;">
            <h1 style="margin:0 0 16px;font-size:22px;font-weight:600;color:#1a1a1a;">Good Morning, ${firstName}!</h1>
            <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#4a4a4a;">Here's your MicroAction for today:</p>
            ${img ? `<div style="margin:0 0 20px;text-align:center;"><img src="${img}" alt="" style="max-width:100%;height:auto;border-radius:8px;" /></div>` : ""}
            <div style="background-color:#f8faf5;border-left:4px solid ${brandColor};border-radius:6px;padding:20px;margin:0 0 24px;">
              <h2 style="margin:0 0 12px;font-size:18px;font-weight:600;color:#1a1a1a;">${esc(actionTitle)}</h2>
              ${quote ? `<p style="margin:0 0 12px;font-size:14px;line-height:1.5;color:#6b7280;font-style:italic;">&ldquo;${esc(quote)}&rdquo;${quoteAuthor ? ` &mdash; ${esc(quoteAuthor)}` : ""}</p>` : ""}
              <p style="margin:0 0 12px;font-size:14px;line-height:1.5;color:#4a4a4a;">${esc(actionDescription)}</p>
              <p style="margin:0;font-size:13px;color:${brandColor};font-weight:600;">~${estimatedMinutes} minutes</p>
            </div>
            <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#4a4a4a;">Ready to commit to this action today? Click the button below to make your commitment.</p>
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 16px;">
              <tr><td style="background-color:${brandColor};border-radius:6px;">
                <a href="${commitUrl}" target="_blank" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">I Commit to This Today!</a>
              </td></tr>
            </table>
            ${swapUrl ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 24px;">
              <tr><td style="border:1px solid #d1d5db;border-radius:6px;">
                <a href="${swapUrl}" target="_blank" style="display:inline-block;padding:10px 24px;font-size:13px;font-weight:600;color:#6b7280;text-decoration:none;">Get a Different Nudge</a>
              </td></tr>
            </table>` : ""}
            <p style="margin:0;font-size:13px;line-height:1.5;color:#9a9a9a;">Small daily actions lead to lasting change.</p>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 40px;border-top:1px solid #eee;text-align:center;">
            <p style="margin:0;font-size:12px;color:#9a9a9a;">${esc(tagline)}</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function buildEveningNudgeEmail(
  assigneeName: string,
  actionTitle: string,
  completeUrl: string,
  skipUrl: string,
  imageUrl?: string,
  quote?: string,
  quoteAuthor?: string,
  swapUrl?: string
): string {
  const firstName = esc(assigneeName.split(" ")[0] || assigneeName);
  const img = proxyImage(imageUrl);

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
        <tr>
          <td style="background-color:${brandColor};padding:28px 40px;text-align:center;">
            <span style="font-size:24px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">${esc(brandName)}</span>
          </td>
        </tr>
        <tr>
          <td style="padding:40px;">
            <h1 style="margin:0 0 16px;font-size:22px;font-weight:600;color:#1a1a1a;">Evening Check-In</h1>
            <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#4a4a4a;">Hi ${firstName}, did you complete your MicroAction today?</p>
            ${img ? `<div style="margin:0 0 20px;text-align:center;"><img src="${img}" alt="" style="max-width:100%;height:auto;border-radius:8px;" /></div>` : ""}
            <div style="background-color:#f8faf5;border-left:4px solid ${brandColor};border-radius:6px;padding:20px;margin:0 0 24px;">
              <h2 style="margin:0 0 12px;font-size:16px;font-weight:600;color:#1a1a1a;">${esc(actionTitle)}</h2>
              ${quote ? `<p style="margin:0;font-size:14px;line-height:1.5;color:#6b7280;font-style:italic;">&ldquo;${esc(quote)}&rdquo;${quoteAuthor ? ` &mdash; ${esc(quoteAuthor)}` : ""}</p>` : ""}
            </div>
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 16px;">
              <tr>
                <td style="background-color:${brandColor};border-radius:6px;padding-right:12px;">
                  <a href="${completeUrl}" target="_blank" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">Yes, I Did It!</a>
                </td>
                <td style="background-color:#e5e7eb;border-radius:6px;">
                  <a href="${skipUrl}" target="_blank" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#4a4a4a;text-decoration:none;">Not Today</a>
                </td>
              </tr>
            </table>
            ${swapUrl ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 20px;">
              <tr><td style="border:1px solid #d1d5db;border-radius:6px;">
                <a href="${swapUrl}" target="_blank" style="display:inline-block;padding:10px 24px;font-size:13px;font-weight:600;color:#6b7280;text-decoration:none;">Get a Different Nudge</a>
              </td></tr>
            </table>` : ""}
            <p style="margin:0;font-size:13px;line-height:1.5;color:#9a9a9a;text-align:center;">Every day is a new opportunity. Keep going!</p>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 40px;border-top:1px solid #eee;text-align:center;">
            <p style="margin:0;font-size:12px;color:#9a9a9a;">${esc(tagline)}</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
