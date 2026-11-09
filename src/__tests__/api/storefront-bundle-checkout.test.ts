import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Storefront checkout of a bundle product: priced as one product, discounted
 * by a coupon or the 50% partner code exactly like a single course, recorded
 * with its learning path on the order line, and (test mode, off the live
 * site) fulfilled by enrolling the buyer in the bundle.
 */

const PRODUCT = "11111111-1111-4111-8111-111111111111";
const PATH = "22222222-2222-4222-8222-222222222222";

const ordersInserted: Record<string, unknown>[] = [];
const itemsInserted: Record<string, unknown>[] = [];
let localCoupon: Record<string, unknown> | null = null;
let pathHasCourses = true;

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
      if (table === "orders") ordersInserted.push(row as Record<string, unknown>);
      if (table === "order_items") itemsInserted.push(...(row as Record<string, unknown>[]));
      return q;
    },
    single: async () => {
      if (table === "storefronts") {
        return {
          data: { id: "store-1", slug: "gothamculture", name: "gC", currency: "USD", is_active: true, volume_discounts_enabled: false, tax_enabled: false, tax_rate: 0 },
        };
      }
      if (table === "coupons") return { data: localCoupon };
      if (table === "orders") return { data: { id: ordersInserted.at(-1)?.id, order_number: "ORD-1" }, error: null };
      return { data: null };
    },
    then: (resolve: (v: unknown) => unknown) => {
      if (table === "products") {
        return resolve({
          data: [
            { id: PRODUCT, name: "Mosaic Certification Bundle", price: 599, discount_price: null, status: "active", course_id: null, learning_path_id: PATH, min_participants: 1, max_participants: null },
          ],
        });
      }
      if (table === "learning_path_items") {
        return resolve({ data: pathHasCourses ? [{ path_id: PATH }] : [], error: null });
      }
      return resolve({ data: null, error: null });
    },
  });
  return q;
}

vi.mock("@/lib/supabase/service", () => ({ createServiceClient: () => ({ from: (t: string) => query(t) }) }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: async () => ({ success: true }) }));
const enrollOrderBuyer = vi.fn(async () => "enrolled");
vi.mock("@/lib/storefront/fulfillment", () => ({
  sendOrderEmails: vi.fn(async () => {}),
  enrollOrderBuyer: (...a: unknown[]) => enrollOrderBuyer(...(a as [])),
  testModeEnrolls: () => true,
}));
vi.mock("@/lib/storefront/stripe", () => ({ isStripeConfigured: () => false, createCheckoutSession: vi.fn() }));

import { POST } from "@/app/api/storefront/checkout/route";

const fetchMock = vi.fn();

function checkout(code?: string) {
  return POST(
    new NextRequest("http://localhost/api/storefront/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        storefront_slug: "gothamculture",
        customer_email: "partner@example.com",
        customer_name: "Pat Partner",
        ...(code && { coupon_code: code }),
        items: [{ product_id: PRODUCT, quantity: 1 }],
      }),
    })
  );
}

beforeEach(() => {
  ordersInserted.length = 0;
  itemsInserted.length = 0;
  localCoupon = null;
  pathHasCourses = true;
  enrollOrderBuyer.mockClear();
  fetchMock.mockReset();
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

describe("storefront checkout — bundle", () => {
  it("sells the bundle at its own price and records the path on the order line", async () => {
    const res = await checkout();
    expect(res.status).toBe(200);
    expect(ordersInserted[0]).toMatchObject({ subtotal: 599, discount_amount: 0, total: 599 });
    expect(itemsInserted).toHaveLength(1);
    expect(itemsInserted[0]).toMatchObject({ product_id: PRODUCT, course_id: null, learning_path_id: PATH, price: 599 });
  });

  it("takes the 50% partner code to $299.50, like a single course", async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ valid: true, code: "GCP-ABCDE23456", percentOff: 50 }), { status: 200 })
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const res = await checkout("GCP-ABCDE23456");
    expect(res.status).toBe(200);
    const evaluate = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(evaluate).toMatchObject({ product: "lms_courses", listPriceCents: 59900 });
    expect(ordersInserted[0]).toMatchObject({ subtotal: 599, discount_amount: 299.5, total: 299.5 });
  });

  it("applies a local percentage coupon to the bundle", async () => {
    localCoupon = { id: "cp1", code: "HALF", discount_type: "percentage", discount_value: 50, current_uses: 0, max_uses: null, min_purchase: null, valid_from: null, valid_until: null };
    const res = await checkout("half");
    expect(res.status).toBe(200);
    expect(ordersInserted[0]).toMatchObject({ total: 299.5 });
  });

  it("test mode enrolls the buyer in the bundle", async () => {
    await checkout();
    expect(enrollOrderBuyer).toHaveBeenCalledTimes(1);
    const [, order, items] = enrollOrderBuyer.mock.calls[0] as unknown as [unknown, Record<string, unknown>, unknown[]];
    expect(order).toMatchObject({ customer_email: "partner@example.com", storefront_id: "store-1" });
    expect(items).toEqual([{ course_id: null, learning_path_id: PATH }]);
  });

  it("refuses a bundle whose learning path has no courses left", async () => {
    pathHasCourses = false;
    const res = await checkout();
    expect(res.status).toBe(409);
    expect(ordersInserted).toHaveLength(0);
  });
});
