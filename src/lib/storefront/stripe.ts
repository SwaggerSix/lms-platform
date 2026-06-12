import crypto from "crypto";

// Minimal Stripe REST client (form-encoded, no SDK dependency).
// When STRIPE_SECRET_KEY is unset the platform runs in "test mode":
// checkout completes immediately without charging a card, so the stores
// can be fully exercised before payments are switched on.

const STRIPE_API = "https://api.stripe.com/v1";

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

function encodeForm(params: Record<string, string>): string {
  return Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
}

async function stripeRequest<T>(
  path: string,
  params?: Record<string, string>
): Promise<T> {
  const res = await fetch(`${STRIPE_API}${path}`, {
    method: params ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      ...(params && { "Content-Type": "application/x-www-form-urlencoded" }),
    },
    body: params ? encodeForm(params) : undefined,
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json?.error?.message || `Stripe error (${res.status})`);
  }
  return json as T;
}

export interface StripeLineItem {
  name: string;
  description?: string;
  imageUrl?: string;
  unitAmountCents: number;
  quantity: number;
}

export interface StripeCheckoutSession {
  id: string;
  url: string;
  payment_status: string;
  payment_intent: string | null;
}

export async function createCheckoutSession(opts: {
  lineItems: StripeLineItem[];
  currency: string;
  customerEmail: string;
  orderId: string;
  orderNumber: string;
  successUrl: string;
  cancelUrl: string;
  discountCents?: number;
}): Promise<StripeCheckoutSession> {
  const params: Record<string, string> = {
    mode: "payment",
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
    customer_email: opts.customerEmail,
    "metadata[order_id]": opts.orderId,
    "metadata[order_number]": opts.orderNumber,
    "payment_intent_data[metadata][order_id]": opts.orderId,
  };

  opts.lineItems.forEach((item, i) => {
    const p = `line_items[${i}]`;
    params[`${p}[quantity]`] = String(item.quantity);
    params[`${p}[price_data][currency]`] = opts.currency.toLowerCase();
    params[`${p}[price_data][unit_amount]`] = String(item.unitAmountCents);
    params[`${p}[price_data][product_data][name]`] = item.name.slice(0, 250);
    if (item.description) {
      params[`${p}[price_data][product_data][description]`] =
        item.description.slice(0, 250);
    }
    if (item.imageUrl?.startsWith("https://")) {
      params[`${p}[price_data][product_data][images][0]`] = item.imageUrl;
    }
  });

  // Coupons are applied as a one-off Stripe coupon so the discount shows on
  // the Stripe-hosted checkout page.
  if (opts.discountCents && opts.discountCents > 0) {
    const coupon = await stripeRequest<{ id: string }>("/coupons", {
      amount_off: String(opts.discountCents),
      currency: opts.currency.toLowerCase(),
      duration: "once",
      name: "Discount",
    });
    params["discounts[0][coupon]"] = coupon.id;
  }

  return stripeRequest<StripeCheckoutSession>("/checkout/sessions", params);
}

export async function retrieveCheckoutSession(
  sessionId: string
): Promise<StripeCheckoutSession> {
  return stripeRequest<StripeCheckoutSession>(
    `/checkout/sessions/${encodeURIComponent(sessionId)}`
  );
}

// Verifies a Stripe webhook signature (Stripe-Signature header) against
// STRIPE_WEBHOOK_SECRET. Returns the parsed event or null if invalid.
export function verifyWebhookSignature(
  payload: string,
  signatureHeader: string | null,
  secret: string,
  toleranceSeconds = 300
): { type: string; data: { object: Record<string, unknown> } } | null {
  if (!signatureHeader) return null;

  const parts = Object.fromEntries(
    signatureHeader.split(",").map((kv) => kv.split("=") as [string, string])
  );
  const timestamp = parts["t"];
  const signature = parts["v1"];
  if (!timestamp || !signature) return null;

  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > toleranceSeconds) return null;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${payload}`)
    .digest("hex");

  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    return JSON.parse(payload);
  } catch {
    return null;
  }
}
