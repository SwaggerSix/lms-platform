import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * A coupon that makes the order free (100% off the Mosaic Certification
 * bundle): the order is recorded as completed at $0 and fulfilled on the spot
 * without Stripe, which cannot take a $0 payment. Anything else still goes to
 * Stripe, and a code limited to another product is refused.
 */

const BUNDLE = "11111111-1111-4111-8111-111111111111";
const OTHER = "33333333-3333-4333-8333-333333333333";
const PATH = "22222222-2222-4222-8222-222222222222";

type Op = { op: string; args: unknown[] };
const log: { table: string; ops: Op[] }[] = [];
let coupon: Record<string, unknown> | null = null;
let stripeOn = true;
let couponClaimSucceeds = true;

function resolve(table: string, ops: Op[]): { data: unknown; error: unknown } {
  const has = (op: string) => ops.some((o) => o.op === op);
  if (table === "storefronts") {
    return { data: { id: "store-1", slug: "gothamculture", name: "gC", currency: "USD", is_active: true, volume_discounts_enabled: false, tax_enabled: true, tax_rate: 0.08 }, error: null };
  }
  if (table === "products" && !has("update")) {
    if (has("single")) return { data: { sales_count: 4 }, error: null };
    return {
      data: [
        { id: BUNDLE, name: "Mosaic Certification Bundle", price: 599, discount_price: null, status: "active", course_id: null, learning_path_id: PATH, min_participants: 1, max_participants: null },
        { id: OTHER, name: "Other course", price: 100, discount_price: null, status: "active", course_id: "course-x", learning_path_id: null, min_participants: 1, max_participants: null },
      ],
      error: null,
    };
  }
  if (table === "learning_path_items") return { data: [{ path_id: PATH }], error: null };
  if (table === "coupons") {
    if (has("update")) return { data: couponClaimSucceeds ? [{ id: coupon?.id }] : [], error: null };
    if (has("maybeSingle")) return { data: coupon, error: null };
    return { data: coupon, error: null };
  }
  if (table === "orders" && has("insert")) {
    const row = ops.find((o) => o.op === "insert")!.args[0] as Record<string, unknown>;
    return { data: { id: row.id, order_number: "ORD-1" }, error: null };
  }
  return { data: null, error: null };
}

function query(table: string) {
  const entry = { table, ops: [] as Op[] };
  log.push(entry);
  const q: Record<string, unknown> = {};
  for (const op of ["select", "eq", "neq", "in", "is", "not", "order", "limit", "update", "insert", "upsert"]) {
    q[op] = (...args: unknown[]) => {
      entry.ops.push({ op, args });
      return q;
    };
  }
  for (const op of ["single", "maybeSingle"]) {
    q[op] = async () => {
      entry.ops.push({ op, args: [] });
      return resolve(table, entry.ops);
    };
  }
  q.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
    Promise.resolve(resolve(table, entry.ops)).then(res, rej);
  return q;
}

vi.mock("@/lib/supabase/service", () => ({ createServiceClient: () => ({ from: (t: string) => query(t) }) }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: async () => ({ success: true }) }));
const enrollOrderBuyer = vi.fn(async () => "invited");
const sendOrderEmails = vi.fn(async () => {});
vi.mock("@/lib/storefront/fulfillment", async (orig) => ({
  ...(await orig<typeof import("@/lib/storefront/fulfillment")>()),
  sendOrderEmails: (...a: unknown[]) => sendOrderEmails(...(a as [])),
  enrollOrderBuyer: (...a: unknown[]) => enrollOrderBuyer(...(a as [])),
  // The live-site guard: no Stripe keys on production must never enroll.
  testModeEnrolls: () => false,
}));
const createCheckoutSession = vi.fn(async () => ({ id: "cs_1", url: "https://stripe.test/cs_1" }));
vi.mock("@/lib/storefront/stripe", () => ({
  isStripeConfigured: () => stripeOn,
  createCheckoutSession: (...a: unknown[]) => createCheckoutSession(...(a as [])),
}));

import { POST } from "@/app/api/storefront/checkout/route";

function checkout(code: string | undefined, productIds: string[] = [BUNDLE]) {
  return POST(
    new NextRequest("http://localhost/api/storefront/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        storefront_slug: "gothamculture",
        customer_email: "New.Person@Example.com",
        customer_name: "New Person",
        ...(code && { coupon_code: code }),
        items: productIds.map((product_id) => ({ product_id, quantity: 1 })),
      }),
    })
  );
}

const orderInsert = () =>
  log.find((e) => e.table === "orders" && e.ops.some((o) => o.op === "insert"))?.ops.find((o) => o.op === "insert")
    ?.args[0] as Record<string, unknown> | undefined;

const freeBundleCoupon = (overrides: Record<string, unknown> = {}) => ({
  id: "cp-free",
  code: "MOSAICFREE",
  discount_type: "percentage",
  discount_value: 100,
  current_uses: 2,
  max_uses: 10,
  min_purchase: null,
  valid_from: null,
  valid_until: null,
  is_active: true,
  product_id: BUNDLE,
  ...overrides,
});

beforeEach(() => {
  log.length = 0;
  coupon = null;
  stripeOn = true;
  couponClaimSucceeds = true;
  enrollOrderBuyer.mockClear();
  sendOrderEmails.mockClear();
  createCheckoutSession.mockClear();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("storefront checkout — coupon that makes the order free", () => {
  it("records a $0 completed order and fulfils it without Stripe", async () => {
    coupon = freeBundleCoupon();
    const res = await checkout("mosaicfree");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ free_order: true });
    expect(body.checkout_url).toContain("/store/gothamculture/success?order=ORD-1");

    expect(createCheckoutSession).not.toHaveBeenCalled();
    expect(orderInsert()).toMatchObject({
      status: "completed",
      subtotal: 599,
      discount_amount: 599,
      tax_amount: 0,
      total: 0,
      payment_method: "coupon",
      customer_email: "new.person@example.com",
    });
    expect((orderInsert()!.metadata as Record<string, unknown>)).toMatchObject({
      coupon_id: "cp-free",
      free_order: true,
    });
    expect((orderInsert()!.metadata as Record<string, unknown>).test_mode).toBeUndefined();

    // The use is claimed atomically (compare-and-set on current_uses).
    const claim = log.find((e) => e.table === "coupons" && e.ops.some((o) => o.op === "update"))!;
    expect(claim.ops.find((o) => o.op === "update")!.args[0]).toEqual({ current_uses: 3 });
    expect(claim.ops).toContainEqual({ op: "eq", args: ["current_uses", 2] });

    // Same fulfilment as the webhook: enroll in the path (and its courses),
    // invite a new buyer, send the order emails, count the sale.
    expect(enrollOrderBuyer).toHaveBeenCalledTimes(1);
    const [, order, items] = enrollOrderBuyer.mock.calls[0] as unknown as [unknown, Record<string, unknown>, unknown[]];
    expect(order).toMatchObject({ customer_email: "new.person@example.com", storefront_id: "store-1" });
    expect(items).toEqual([{ course_id: null, learning_path_id: PATH }]);
    expect(sendOrderEmails).toHaveBeenCalledWith(expect.anything(), orderInsert()!.id, expect.any(String), "invited");
    const salesUpdate = log.find((e) => e.table === "products" && e.ops.some((o) => o.op === "update"));
    expect(salesUpdate?.ops.find((o) => o.op === "update")!.args[0]).toEqual({ sales_count: 5 });
  });

  it("is free on a store without Stripe keys too, despite the live-site guard", async () => {
    stripeOn = false;
    coupon = freeBundleCoupon();
    const res = await checkout("MOSAICFREE");
    expect(res.status).toBe(200);
    expect(orderInsert()).toMatchObject({ status: "completed", total: 0, payment_method: "coupon" });
    expect(enrollOrderBuyer).toHaveBeenCalledTimes(1);
  });

  it("a fixed coupon at or above the price is free as well", async () => {
    coupon = freeBundleCoupon({ discount_type: "fixed", discount_value: 1000 });
    const res = await checkout("MOSAICFREE");
    expect(res.status).toBe(200);
    expect(orderInsert()).toMatchObject({ total: 0, discount_amount: 599 });
    expect(createCheckoutSession).not.toHaveBeenCalled();
  });

  it("refuses when the last use was just taken by someone else", async () => {
    coupon = freeBundleCoupon();
    couponClaimSucceeds = false;
    const res = await checkout("MOSAICFREE");
    expect(res.status).toBe(400);
    expect(orderInsert()).toBeUndefined();
    expect(enrollOrderBuyer).not.toHaveBeenCalled();
  });

  it("refuses a used-up or expired code", async () => {
    coupon = freeBundleCoupon({ current_uses: 10 });
    expect((await checkout("MOSAICFREE")).status).toBe(400);
    coupon = freeBundleCoupon({ valid_until: "2020-01-01T00:00:00Z" });
    expect((await checkout("MOSAICFREE")).status).toBe(400);
    expect(orderInsert()).toBeUndefined();
  });
});

describe("storefront checkout — coupons that leave something to pay", () => {
  it("a partial coupon still goes to Stripe", async () => {
    coupon = freeBundleCoupon({ discount_value: 50 });
    const res = await checkout("MOSAICFREE");
    expect(res.status).toBe(200);
    expect((await res.json()).checkout_url).toBe("https://stripe.test/cs_1");
    expect(createCheckoutSession).toHaveBeenCalledTimes(1);
    expect(orderInsert()).toMatchObject({ status: "pending", payment_method: "card" });
    expect(enrollOrderBuyer).not.toHaveBeenCalled();
    // Coupon uses are counted by the webhook once Stripe confirms payment.
    expect(log.some((e) => e.table === "coupons" && e.ops.some((o) => o.op === "update"))).toBe(false);
  });

  it("a product-limited 100% code only frees that product; the rest goes to Stripe", async () => {
    coupon = freeBundleCoupon();
    const res = await checkout("MOSAICFREE", [BUNDLE, OTHER]);
    expect(res.status).toBe(200);
    expect(orderInsert()).toMatchObject({ subtotal: 699, discount_amount: 599, total: 108 });
    expect(createCheckoutSession).toHaveBeenCalledTimes(1);
    expect(enrollOrderBuyer).not.toHaveBeenCalled();
  });

  it("refuses a code limited to another product", async () => {
    coupon = freeBundleCoupon({ product_id: OTHER });
    const res = await checkout("MOSAICFREE", [BUNDLE]);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/different product/);
    expect(orderInsert()).toBeUndefined();
    expect(createCheckoutSession).not.toHaveBeenCalled();
  });

  it("without Stripe keys on the live site, a normal order never enrolls", async () => {
    stripeOn = false;
    const res = await checkout(undefined);
    expect(res.status).toBe(200);
    expect(orderInsert()).toMatchObject({ payment_method: "test_mode", total: 646.92 });
    expect(enrollOrderBuyer).not.toHaveBeenCalled();
  });
});
