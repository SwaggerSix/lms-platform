import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import crypto from "crypto";
import { NextRequest } from "next/server";

/**
 * Storefront checkout with a gC partner code.
 *
 * Contract (gc-partner-portal docs/PARTNER_CODE_API.md): a GCP- code that is
 * not a local coupon is priced by the partner portal for `lms_courses`, under
 * the order's own id; it discounts like a percentage coupon; a refusal or an
 * unreachable portal stops checkout (never an unchecked discount); test mode
 * reports the order paid at once, a failed Stripe session voids the use.
 */

const inserted: Record<string, unknown>[] = [];
let localCoupon: Record<string, unknown> | null = null;

function query(table: string) {
  const q: Record<string, unknown> = {};
  const chain = () => q;
  Object.assign(q, {
    select: chain,
    eq: chain,
    in: chain,
    is: chain,
    update: () => q,
    insert: (row: Record<string, unknown> | Record<string, unknown>[]) => {
      if (table === "orders") inserted.push(row as Record<string, unknown>);
      return q;
    },
    single: async () => {
      if (table === "storefronts") {
        return {
          data: { id: "store-1", slug: "ggs", name: "GGS", currency: "USD", is_active: true, volume_discounts_enabled: false, tax_enabled: false, tax_rate: 0 },
        };
      }
      if (table === "coupons") return { data: localCoupon };
      if (table === "orders") return { data: { id: inserted.at(-1)?.id, order_number: "ORD-1" }, error: null };
      return { data: null };
    },
    then: (resolve: (v: unknown) => unknown) =>
      resolve(
        table === "products"
          ? { data: [{ id: PRODUCT, name: "Leading", price: 500, discount_price: null, status: "active", course_id: "c1", min_participants: 1, max_participants: null }] }
          : { data: null, error: null }
      ),
  });
  return q;
}

vi.mock("@/lib/supabase/service", () => ({ createServiceClient: () => ({ from: (t: string) => query(t) }) }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: async () => ({ success: true }) }));
vi.mock("@/lib/storefront/fulfillment", () => ({ sendOrderEmails: vi.fn(async () => {}) }));
const createCheckoutSession = vi.fn();
let stripeOn = false;
vi.mock("@/lib/storefront/stripe", () => ({
  isStripeConfigured: () => stripeOn,
  createCheckoutSession: (...a: unknown[]) => createCheckoutSession(...a),
}));

import { POST } from "@/app/api/storefront/checkout/route";

const PRODUCT = "11111111-1111-4111-8111-111111111111";
const fetchMock = vi.fn();

function reply(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function checkout(code: string) {
  return POST(
    new NextRequest("http://localhost/api/storefront/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        storefront_slug: "ggs",
        customer_email: "Buyer@Client.com",
        customer_name: "Pat Buyer",
        company_name: "Client Co",
        coupon_code: code,
        items: [{ product_id: PRODUCT, quantity: 2 }],
      }),
    })
  );
}

beforeEach(() => {
  inserted.length = 0;
  localCoupon = null;
  stripeOn = false;
  fetchMock.mockReset();
  createCheckoutSession.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("PARTNER_PORTAL_API_URL", "https://partners.example.com");
  vi.stubEnv("PARTNER_CODE_PORTAL_SECRET", "lms-secret");
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("storefront checkout — partner code", () => {
  it("prices a GCP- code through the portal as lms_courses and discounts the order", async () => {
    fetchMock
      .mockResolvedValueOnce(reply(200, { valid: true, code: "GCP-ABCDE23456", percentOff: 20 }))
      .mockResolvedValueOnce(reply(200, { ok: true, status: "paid" }));

    const res = await checkout("gcp-abcde23456");
    expect(res.status).toBe(200);

    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(String(url)).toBe("https://partners.example.com/api/integrations/partner-codes/evaluate");
    const headers = init.headers as Record<string, string>;
    expect(headers["X-Partner-Code-Platform"]).toBe("lms");
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({
      mode: "evaluate",
      product: "lms_courses",
      code: "GCP-ABCDE23456",
      buyerEmail: "buyer@client.com",
      buyerOrg: "Client Co",
      listPriceCents: 100000,
    });
    const expected = `sha256=${crypto
      .createHmac("sha256", "lms-secret")
      .update(`${headers["X-Partner-Code-Timestamp"]}.${headers["X-Partner-Code-Request-Id"]}.${init.body}`)
      .digest("hex")}`;
    expect(headers["X-Partner-Code-Signature"]).toBe(expected);

    const order = inserted[0];
    expect(order.id).toBe(body.orderRef);
    expect(order).toMatchObject({ subtotal: 1000, discount_amount: 200, total: 800 });
    expect(order.metadata).toMatchObject({ partner_code: "GCP-ABCDE23456", partner_portal_ref: body.orderRef });

    // Test mode completes on the spot, so the use is reported paid.
    expect(JSON.parse(fetchMock.mock.calls[1][1].body as string)).toEqual({ orderRef: body.orderRef, status: "paid" });
  });

  it("passes the portal's refusal through and creates no order", async () => {
    fetchMock.mockResolvedValueOnce(reply(200, { valid: false, reason: "buyer_limit", message: "Shared too widely." }));
    const res = await checkout("GCP-ABCDE23456");
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Shared too widely." });
    expect(inserted).toHaveLength(0);
  });

  it("shows the portal's partner_only message to a buyer who isn't the partner", async () => {
    const message =
      "This code can only be used by the Gotham partner it belongs to, signed in with their own email.";
    fetchMock.mockResolvedValueOnce(reply(200, { valid: false, reason: "partner_only", message }));
    const res = await checkout("GCP-ABCDE23456");
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: message });
    expect(inserted).toHaveLength(0);
  });

  it("fails closed when the portal can't be reached", async () => {
    fetchMock.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    const res = await checkout("GCP-ABCDE23456");
    expect(res.status).toBe(503);
    expect(inserted).toHaveLength(0);
  });

  it("voids the use when Stripe won't open the checkout", async () => {
    stripeOn = true;
    createCheckoutSession.mockRejectedValue(new Error("stripe down"));
    fetchMock
      .mockResolvedValueOnce(reply(200, { valid: true, code: "GCP-ABCDE23456", percentOff: 20 }))
      .mockResolvedValueOnce(reply(200, { ok: true, status: "void" }));
    const res = await checkout("GCP-ABCDE23456");
    expect(res.status).toBe(502);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body as string).status).toBe("void");
  });

  it("leaves local coupons alone and ignores partner codes when the portal isn't configured", async () => {
    localCoupon = { id: "cp1", code: "SPRING", discount_type: "percentage", discount_value: 10, is_active: true, current_uses: 0 };
    expect((await checkout("SPRING")).status).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();

    vi.stubEnv("PARTNER_PORTAL_API_URL", "");
    localCoupon = null;
    const res = await checkout("GCP-ABCDE23456");
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
