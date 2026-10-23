import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Refunds of partner-code orders are reported to the gC partner portal as
 * void, so the use stops counting toward the partner's buyer limit
 * (gc-partner-portal docs/PARTNER_CODE_API.md). Every refund path does it:
 * the storefront admin refund / cancel, the shop order status change, and a
 * full `charge.refunded` from Stripe. It is best effort — the refund itself
 * never fails because the portal did — and only a FULL refund or a
 * cancellation voids; a partial refund leaves the buyer holding seats.
 */

const ORDER_ID = "22222222-2222-4222-8222-222222222222";
const PARTNER_META = { partner_code: "GCP-ABCDE23456", partner_discount_percent: 20, partner_portal_ref: ORDER_ID };

let order: Record<string, unknown> | null = null;
let updatedStatus: string | null = null;
const lookups: { column: string; value: unknown }[] = [];

function query(table: string) {
  const q: Record<string, unknown> = {};
  let isUpdate = false;
  Object.assign(q, {
    select: () => q,
    limit: () => q,
    neq: () => q,
    delete: () => q,
    eq: (column: string, value: unknown) => {
      if (table === "orders" && !isUpdate) lookups.push({ column, value });
      return q;
    },
    update: (row: Record<string, unknown>) => {
      isUpdate = true;
      if (table === "orders" && typeof row.status === "string") updatedStatus = row.status;
      return q;
    },
    single: async () => {
      if (table !== "orders") return { data: null, error: null };
      if (isUpdate) {
        return { data: { ...order, status: updatedStatus ?? order?.status }, error: null };
      }
      return { data: order, error: null };
    },
    then: (resolve: (v: unknown) => unknown) =>
      resolve(table === "orders" && !isUpdate ? { data: order ? [order] : [], error: null } : { data: null, error: null }),
  });
  return q;
}

vi.mock("@/lib/supabase/service", () => ({ createServiceClient: () => ({ from: (t: string) => query(t) }) }));
vi.mock("@/lib/auth/authorize", () => ({
  authorize: async () => ({ authorized: true, user: { id: "admin-1", role: "super_admin" } }),
}));
const refundPayment = vi.fn(async () => ({}));
let stripeEvent: { type: string; data: { object: Record<string, unknown> } } | null = null;
vi.mock("@/lib/storefront/stripe", () => ({
  isStripeConfigured: () => true,
  refundPayment: (...a: unknown[]) => refundPayment(...(a as [])),
  verifyWebhookSignature: () => stripeEvent,
}));
vi.mock("@/lib/integrations/qbo-sync", () => ({
  enqueueOrderRefunded: vi.fn(async () => {}),
  enqueueOrderCompleted: vi.fn(async () => {}),
}));
vi.mock("@/lib/storefront/fulfillment", () => ({ sendOrderEmails: vi.fn(), inviteAndEnroll: vi.fn() }));

import { PATCH as adminPatch } from "@/app/api/storefront/admin/[id]/orders/route";
import { PUT as shopPut } from "@/app/api/shop/orders/[id]/route";
import { POST as webhook } from "@/app/api/storefront/webhook/route";
import { voidPartnerRedemptionForOrder, partnerPortalRef } from "@/lib/storefront/partner-code";

const fetchMock = vi.fn();

function reply(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function portalCalls() {
  return fetchMock.mock.calls.map(([url, init]) => ({
    url: String(url),
    body: JSON.parse((init as RequestInit).body as string),
  }));
}

function adminRequest(body: Record<string, unknown>) {
  return adminPatch(
    new NextRequest("http://localhost/api/storefront/admin/store-1/orders", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ order_id: ORDER_ID, ...body }),
    }),
    { params: Promise.resolve({ id: "store-1" }) }
  );
}

function stripeDelivery(event: { type: string; data: { object: Record<string, unknown> } }) {
  stripeEvent = event;
  return webhook(
    new NextRequest("http://localhost/api/storefront/webhook", {
      method: "POST",
      headers: { "stripe-signature": "t=1,v1=x" },
      body: JSON.stringify(event),
    })
  );
}

beforeEach(() => {
  order = {
    id: ORDER_ID,
    status: "completed",
    total: 800,
    refunded_amount: 0,
    payment_intent_id: "pi_123",
    status_history: [],
    metadata: PARTNER_META,
    order_items: [],
    user_id: "u1",
  };
  updatedStatus = null;
  lookups.length = 0;
  stripeEvent = null;
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(reply(200, { ok: true, status: "void" }));
  refundPayment.mockClear();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("PARTNER_PORTAL_API_URL", "https://partners.example.com");
  vi.stubEnv("PARTNER_CODE_PORTAL_SECRET", "lms-secret");
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_test");
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("voidPartnerRedemptionForOrder", () => {
  it("reports void under the order's partner_portal_ref", async () => {
    expect(await voidPartnerRedemptionForOrder(PARTNER_META)).toBe(true);
    expect(portalCalls()).toEqual([
      {
        url: "https://partners.example.com/api/integrations/partner-codes/redemptions",
        body: { orderRef: ORDER_ID, status: "void" },
      },
    ]);
    const headers = (fetchMock.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    expect(headers["X-Partner-Code-Platform"]).toBe("lms");
    expect(headers["X-Partner-Code-Signature"]).toMatch(/^sha256=[0-9a-f]{64}$/);
  });

  it("ignores orders without a partner code", async () => {
    expect(partnerPortalRef(null)).toBeNull();
    expect(partnerPortalRef({ coupon_id: "cp1" })).toBeNull();
    expect(await voidPartnerRedemptionForOrder({ coupon_id: "cp1" })).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("treats 404 / 409 as settled and logs nothing", async () => {
    fetchMock.mockResolvedValueOnce(reply(409, { error: "already void" }));
    expect(await voidPartnerRedemptionForOrder(PARTNER_META)).toBe(false);
    fetchMock.mockResolvedValueOnce(reply(404, { error: "unknown ref" }));
    expect(await voidPartnerRedemptionForOrder(PARTNER_META)).toBe(false);
    expect(console.error).not.toHaveBeenCalled();
  });

  it("never throws when the portal is down", async () => {
    fetchMock.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    await expect(voidPartnerRedemptionForOrder(PARTNER_META)).resolves.toBe(false);
    expect(console.error).toHaveBeenCalled();
  });
});

describe("storefront admin refund / cancel", () => {
  it("voids the use on a full refund", async () => {
    const res = await adminRequest({ refund_amount: 800 });
    expect(res.status).toBe(200);
    expect(refundPayment).toHaveBeenCalledWith("pi_123", 80000);
    expect(portalCalls()).toEqual([expect.objectContaining({ body: { orderRef: ORDER_ID, status: "void" } })]);
  });

  it("does not void on a partial refund", async () => {
    const res = await adminRequest({ refund_amount: 100 });
    expect(res.status).toBe(200);
    expect(updatedStatus).toBe("partially_refunded");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("voids when a partial refund is topped up to the full amount", async () => {
    order = { ...order, status: "partially_refunded", refunded_amount: 100 };
    const res = await adminRequest({ refund_amount: 700 });
    expect(res.status).toBe(200);
    expect(portalCalls()).toHaveLength(1);
  });

  it("voids when the order is cancelled", async () => {
    const res = await adminRequest({ status: "cancelled" });
    expect(res.status).toBe(200);
    expect(portalCalls()[0].body).toEqual({ orderRef: ORDER_ID, status: "void" });
  });

  it("does not void an order without a partner code", async () => {
    order = { ...order, metadata: { coupon_id: "cp1" } };
    expect((await adminRequest({ refund_amount: 800 })).status).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("still completes the refund when the portal fails", async () => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(reply(500, { error: "boom" }));
    const res = await adminRequest({ refund_amount: 800 });
    expect(res.status).toBe(200);
    expect((await res.json()).order.status).toBe("refunded");
  });
});

describe("shop order status change", () => {
  it("voids the use when an order is marked refunded", async () => {
    const res = await shopPut(
      new NextRequest(`http://localhost/api/shop/orders/${ORDER_ID}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "refunded" }),
      }),
      { params: Promise.resolve({ id: ORDER_ID }) }
    );
    expect(res.status).toBe(200);
    expect(portalCalls()[0].body).toEqual({ orderRef: ORDER_ID, status: "void" });
  });
});

describe("Stripe charge.refunded", () => {
  it("voids the use on a full refund, finding the order by payment intent", async () => {
    const res = await stripeDelivery({
      type: "charge.refunded",
      data: { object: { id: "ch_1", payment_intent: "pi_123", refunded: true, amount: 80000, amount_refunded: 80000 } },
    });
    expect(res.status).toBe(200);
    expect(lookups).toContainEqual({ column: "payment_intent_id", value: "pi_123" });
    expect(portalCalls()[0].body).toEqual({ orderRef: ORDER_ID, status: "void" });
  });

  it("does not void on a partial refund", async () => {
    const res = await stripeDelivery({
      type: "charge.refunded",
      data: { object: { id: "ch_1", payment_intent: "pi_123", refunded: false, amount: 80000, amount_refunded: 10000 } },
    });
    expect(res.status).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("acknowledges the event even when the portal is down", async () => {
    fetchMock.mockReset();
    fetchMock.mockRejectedValue(new Error("ECONNREFUSED"));
    const res = await stripeDelivery({
      type: "charge.refunded",
      data: { object: { id: "ch_1", payment_intent: "pi_123", refunded: true } },
    });
    expect(res.status).toBe(200);
  });
});
