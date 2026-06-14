// Storefront transactional email templates. These are branded per-store (the
// store's primary color drives the header) and cover the order lifecycle a
// B2B client sees: order confirmation, an internal new-order notification for
// the store team, and abandoned-cart recovery.

import type { EmailTemplate } from "@/lib/email/templates";

export interface OrderEmailLine {
  name: string;
  quantity: number; // seats
  unitPrice: number;
  lineTotal: number;
}

export interface OrderEmailData {
  storeName: string;
  brandColor: string;
  orderNumber: string;
  companyName?: string | null;
  customerName: string;
  customerEmail: string;
  customerPhone?: string | null;
  poNumber?: string | null;
  orderNotes?: string | null;
  lines: OrderEmailLine[];
  subtotal: number;
  discount: number;
  tax: number;
  taxLabel: string;
  total: number;
  currency: string;
  manageUrl?: string;
  receiptUrl?: string;
  enrollmentStatus?: "enrolled" | "invited" | "pending" | null;
}

const money = (n: number, currency = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n);

function layout(brandColor: string, storeName: string, inner: string): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 0;"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1);">
<tr><td style="background:${brandColor};padding:24px 32px;"><h1 style="margin:0;color:#fff;font-size:20px;font-weight:700;">${storeName}</h1></td></tr>
<tr><td style="padding:32px;">${inner}</td></tr>
<tr><td style="padding:20px 32px;border-top:1px solid #e5e7eb;background:#f9fafb;"><p style="margin:0;color:#6b7280;font-size:12px;text-align:center;">${storeName} â thank you for your business.</p></td></tr>
</table></td></tr></table></body></html>`;
}

function lineItemsTable(data: OrderEmailData): string {
  const rows = data.lines
    .map(
      (l) => `<tr>
<td style="padding:10px 0;border-bottom:1px solid #eef2f7;color:#111827;font-size:14px;">${l.name}<div style="color:#6b7280;font-size:12px;">${l.quantity} ${l.quantity === 1 ? "seat" : "seats"} Ã ${money(l.unitPrice, data.currency)}</div></td>
<td style="padding:10px 0;border-bottom:1px solid #eef2f7;color:#111827;font-size:14px;text-align:right;white-space:nowrap;">${money(l.lineTotal, data.currency)}</td>
</tr>`
    )
    .join("");

  const summaryRow = (label: string, value: string, bold = false) =>
    `<tr><td style="padding:4px 0;color:${bold ? "#111827" : "#6b7280"};font-size:${bold ? "15px" : "13px"};font-weight:${bold ? "700" : "400"};">${label}</td><td style="padding:4px 0;text-align:right;color:#111827;font-size:${bold ? "15px" : "13px"};font-weight:${bold ? "700" : "400"};">${value}</td></tr>`;

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 16px;">
${rows}
${summaryRow("Subtotal", money(data.subtotal, data.currency))}
${data.discount > 0 ? summaryRow("Discount", "-" + money(data.discount, data.currency)) : ""}
${data.tax > 0 ? summaryRow(data.taxLabel, money(data.tax, data.currency)) : ""}
${summaryRow("Total", money(data.total, data.currency), true)}
</table>`;
}

export function orderConfirmation(data: OrderEmailData): EmailTemplate {
  const inner = `
<h2 style="margin:0 0 12px;color:#111827;font-size:18px;">Order confirmed</h2>
<p style="margin:0 0 16px;color:#374151;font-size:14px;line-height:1.6;">
Hi ${data.customerName}, thank you${data.companyName ? ` â we've received your order for <strong>${data.companyName}</strong>` : ""}. Your order number is <strong>${data.orderNumber}</strong>.
</p>
${lineItemsTable(data)}
${data.poNumber ? `<p style="margin:0 0 8px;color:#6b7280;font-size:13px;">PO number: <strong>${data.poNumber}</strong></p>` : ""}
<p style="margin:16px 0 0;color:#374151;font-size:14px;line-height:1.6;">Our team will be in touch to confirm scheduling and collect your attendee roster for each course. Questions? Just reply to this email.</p>
`;
  return {
    subject: `${data.storeName}: order ${data.orderNumber} confirmed`,
    html: layout(data.brandColor, data.storeName, inner),
    text: `Hi ${data.customerName}, your order ${data.orderNumber} is confirmed. Total: ${money(data.total, data.currency)}. Our team will follow up to schedule and collect attendee rosters.`,
  };
}

function enrollmentBadge(status: NonNullable<OrderEmailData["enrollmentStatus"]>): string {
  if (status === "enrolled") {
    return `<span style="background:#dcfce7;color:#166534;padding:3px 10px;border-radius:12px;font-size:12px;font-weight:600;">â LMS: auto-enrolled</span>`;
  }
  if (status === "invited") {
    return `<span style="background:#dbeafe;color:#1e40af;padding:3px 10px;border-radius:12px;font-size:12px;font-weight:600;">â LMS: invite sent â account created</span>`;
  }
  return `<span style="background:#fef3c7;color:#92400e;padding:3px 10px;border-radius:12px;font-size:12px;font-weight:600;">â  LMS: ACTION NEEDED â create account manually</span>`;
}

export function orderNotification(data: OrderEmailData): EmailTemplate {
  const inner = `
<h2 style="margin:0 0 12px;color:#111827;font-size:18px;">New order: ${data.orderNumber}</h2>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;">
<tr><td style="padding:3px 0;color:#6b7280;font-size:13px;">Company</td><td style="padding:3px 0;text-align:right;color:#111827;font-size:13px;">${data.companyName || "â"}</td></tr>
<tr><td style="padding:3px 0;color:#6b7280;font-size:13px;">Contact</td><td style="padding:3px 0;text-align:right;color:#111827;font-size:13px;">${data.customerName}</td></tr>
<tr><td style="padding:3px 0;color:#6b7280;font-size:13px;">Email</td><td style="padding:3px 0;text-align:right;color:#111827;font-size:13px;">${data.customerEmail}</td></tr>
${data.customerPhone ? `<tr><td style="padding:3px 0;color:#6b7280;font-size:13px;">Phone</td><td style="padding:3px 0;text-align:right;color:#111827;font-size:13px;">${data.customerPhone}</td></tr>` : ""}
${data.poNumber ? `<tr><td style="padding:3px 0;color:#6b7280;font-size:13px;">PO number</td><td style="padding:3px 0;text-align:right;color:#111827;font-size:13px;">${data.poNumber}</td></tr>` : ""}
</table>
${lineItemsTable(data)}
${data.orderNotes ? `<div style="padding:12px 16px;background:#f9fafb;border-radius:6px;border-left:4px solid ${data.brandColor};margin:0 0 8px;"><p style="margin:0;color:#374151;font-size:13px;"><strong>Client notes:</strong> ${data.orderNotes}</p></div>` : ""}
${data.enrollmentStatus ? `<p style="margin:12px 0 0;">${enrollmentBadge(data.enrollmentStatus)}</p>` : ""}
${data.manageUrl ? `<p style="margin:16px 0 0;font-size:14px;"><a href="${data.manageUrl}" style="color:${data.brandColor};font-weight:600;">Open in admin â</a></p>` : ""}
`;
  return {
    subject: `New order ${data.orderNumber} â ${data.companyName || data.customerName} (${money(data.total, data.currency)})`,
    html: layout(data.brandColor, data.storeName, inner),
    text: `New order ${data.orderNumber} from ${data.companyName || data.customerName} (${data.customerEmail}). Total ${money(data.total, data.currency)}.${data.enrollmentStatus === "enrolled" ? " LMS: auto-enrolled." : data.enrollmentStatus === "invited" ? " LMS: invite sent â account created." : data.enrollmentStatus === "pending" ? " LMS: ACTION NEEDED â create account manually." : ""}`,
  };
}

export function abandonedCartRecovery(params: {
  storeName: string;
  brandColor: string;
  customerName?: string | null;
  recoveryUrl: string;
  lines: { name: string; quantity: number }[];
}): EmailTemplate {
  const items = params.lines
    .map(
      (l) =>
        `<li style="margin:0 0 4px;color:#374151;font-size:14px;">${l.name} <span style="color:#6b7280;">(${l.quantity} ${l.quantity === 1 ? "seat" : "seats"})</span></li>`
    )
    .join("");
  const inner = `
<h2 style="margin:0 0 12px;color:#111827;font-size:18px;">Still planning your training?</h2>
<p style="margin:0 0 12px;color:#374151;font-size:14px;line-height:1.6;">Hi ${params.customerName || "there"}, you left the following in your cart at ${params.storeName}:</p>
<ul style="margin:0 0 16px;padding-left:20px;">${items}</ul>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 16px;"><tr><td style="background:${params.brandColor};border-radius:6px;"><a href="${params.recoveryUrl}" style="display:inline-block;padding:12px 24px;color:#fff;text-decoration:none;font-size:14px;font-weight:600;">Resume your order</a></td></tr></table>
<p style="margin:0;color:#6b7280;font-size:13px;">Need a quote, a PO, or have questions about scheduling? Just reply â we're happy to help.</p>
`;
  return {
    subject: `${params.storeName}: your cart is waiting`,
    html: layout(params.brandColor, params.storeName, inner),
    text: `Hi ${params.customerName || "there"}, you left items in your cart at ${params.storeName}. Resume your order: ${params.recoveryUrl}`,
  };
}
