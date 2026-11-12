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
 *
 * Courses marked partner_code_eligible = false (MOS-210 Coaching Studio,
 * MOS-220 SurveyCraft; operator decision 2026-11-12) are full price: their
 * lines (or a bundle containing one) are left out of the discount and of the
 * price the portal is asked about, and a cart of only those refuses the code
 * without asking the portal.
 */

const inserted: Record<string, unknown>[] = [];
let localCoupon: Record<string, unknown> | null = null;
let cartProducts: Record<string, unknown>[] = [];
let pathItems: { path_id: string; course_id: string }[] = [];
let ineligibleCourses: string[] = [];
let coursesError: { message: string } | null = null;
const courseLookups: unknown[][] = [];

function query(table: string) {
  const q: Record<string, unknown> = {};
  const chain = () => q;
  Object.assign(q, {
    select: chain,
    eq: chain,
    in: (...args: unknown[]) => {
      if (table === "courses") courseLookups.push(args);
      return q;
    },
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
    then: (resolve: (v: unknown) => unknown) => {
      if (table === "products") return resolve({ data: cartProducts });
      if (table === "learning_path_items") return resolve({ data: pathItems, error: null });
      if (table === "courses") {
        return resolve(
          coursesError
            ? { data: null, error: coursesError }
            : { data: ineligibleCourses.map((id) => ({ id })), error: null }
        );
      }
      return resolve({ data: null, error: null });
    },
  });
  return q;
}

vi.mock("@/lib/supabase/service", () => ({ createServiceClient: () => ({ from: (t: string) => query(t) }) }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: async () => ({ success: true }) }));
vi.mock("@/lib/storefront/fulfillment", () => ({
  sendOrderEmails: vi.fn(async () => {}),
  enrollOrderBuyer: vi.fn(async () => null),
  testModeEnrolls: () => false,
}));
const createCheckoutSession = vi.fn();
let stripeOn = false;
vi.mock("@/lib/storefront/stripe", () => ({
  isStripeConfigured: () => stripeOn,
  createCheckoutSession: (...a: unknown[]) => createCheckoutSession(...a),
}));

import { POST } from "@/app/api/storefront/checkout/route";

const PRODUCT = "11111111-1111-4111-8111-111111111111";
const SURVEYCRAFT = "33333333-3333-4333-8333-333333333333";
const COACHING = "44444444-4444-4444-8444-444444444444";
const BUNDLE = "55555555-5555-4555-8555-555555555555";
const MOS220 = "19fdd7b3-df49-467a-9b3e-71b105148cae";
const MOS210 = "6aec94da-f201-49bc-94c8-93cb37301dc4";

const product = (id: string, name: string, price: number, extra: Record<string, unknown>) => ({
  id, name, price, discount_price: null, status: "active", course_id: null, learning_path_id: null,
  min_participants: 1, max_participants: null, ...extra,
});
const LEADING = product(PRODUCT, "Leading", 500, { course_id: "c1" });
const SURVEYCRAFT_PRODUCT = product(SURVEYCRAFT, "MOS-220 SurveyCraft", 300, { course_id: MOS220 });
const COACHING_PRODUCT = product(COACHING, "MOS-210 Coaching Studio", 400, { course_id: MOS210 });

const fetchMock = vi.fn();

function reply(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function checkout(code: string, items: { product_id: string; quantity: number }[] = [{ product_id: PRODUCT, quantity: 2 }]) {
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
        items,
      }),
    })
  );
}

beforeEach(() => {
  inserted.length = 0;
  localCoupon = null;
  cartProducts = [LEADING];
  pathItems = [];
  ineligibleCourses = [MOS210, MOS220];
  coursesError = null;
  courseLookups.length = 0;
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
    expect(order.metadata).not.toHaveProperty("partner_excluded_product_ids");

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

describe("storefront checkout — partner code and the specialist courses (MOS-210, MOS-220)", () => {
  const evaluated = () => JSON.parse(fetchMock.mock.calls[0][1].body as string);

  it("refuses the code on a cart of only full-price courses, without asking the portal", async () => {
    cartProducts = [SURVEYCRAFT_PRODUCT, COACHING_PRODUCT];
    const res = await checkout("GCP-ABCDE23456", [
      { product_id: SURVEYCRAFT, quantity: 1 },
      { product_id: COACHING, quantity: 1 },
    ]);
    expect(res.status).toBe(400);
    const { error } = await res.json();
    expect(error).toMatch(/^Partner codes don't apply to MOS-220 SurveyCraft or MOS-210 Coaching Studio/);
    expect(fetchMock).not.toHaveBeenCalled(); // no pending use recorded on the portal
    expect(inserted).toHaveLength(0);
  });

  it("refuses it on a single SurveyCraft line too", async () => {
    cartProducts = [SURVEYCRAFT_PRODUCT];
    const res = await checkout("GCP-ABCDE23456", [{ product_id: SURVEYCRAFT, quantity: 3 }]);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe(
      "Partner codes don't apply to MOS-220 SurveyCraft — partners pay full price for it. Remove the code to continue."
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("discounts only the eligible lines of a mixed cart and prices only them with the portal", async () => {
    cartProducts = [LEADING, SURVEYCRAFT_PRODUCT];
    fetchMock
      .mockResolvedValueOnce(reply(200, { valid: true, code: "GCP-ABCDE23456", percentOff: 20 }))
      .mockResolvedValueOnce(reply(200, { ok: true, status: "paid" }));

    const res = await checkout("GCP-ABCDE23456", [
      { product_id: PRODUCT, quantity: 2 }, // 2 × $500 = $1,000, eligible
      { product_id: SURVEYCRAFT, quantity: 1 }, // $300, full price
    ]);
    expect(res.status).toBe(200);

    expect(evaluated().listPriceCents).toBe(100000); // the eligible $1,000 only
    const order = inserted[0];
    // 20% of $1,000 — not of the $1,300 order.
    expect(order).toMatchObject({ subtotal: 1300, discount_amount: 200, total: 1100 });
    expect(order.metadata).toMatchObject({
      partner_code: "GCP-ABCDE23456",
      partner_discount_percent: 20,
      coupon_discount: 200,
      partner_excluded_product_ids: [SURVEYCRAFT],
    });
  });

  it("charges Stripe the eligible-only discount on a mixed cart", async () => {
    stripeOn = true;
    cartProducts = [LEADING, COACHING_PRODUCT];
    createCheckoutSession.mockResolvedValue({ id: "cs_1", url: "https://stripe.example/cs_1" });
    fetchMock.mockResolvedValueOnce(reply(200, { valid: true, code: "GCP-ABCDE23456", percentOff: 50 }));

    const res = await checkout("GCP-ABCDE23456", [
      { product_id: PRODUCT, quantity: 1 },
      { product_id: COACHING, quantity: 1 },
    ]);
    expect(res.status).toBe(200);
    expect(evaluated().listPriceCents).toBe(50000);
    expect(createCheckoutSession.mock.calls[0][0]).toMatchObject({ discountCents: 25000 });
    expect(inserted[0]).toMatchObject({ subtotal: 900, discount_amount: 250, total: 650 });
  });

  it("leaves a bundle that includes a full-price course out of the discount", async () => {
    const PATH = "66666666-6666-4666-8666-666666666666";
    cartProducts = [LEADING, product(BUNDLE, "Specialist bundle", 600, { learning_path_id: PATH })];
    pathItems = [
      { path_id: PATH, course_id: "c-mos100" },
      { path_id: PATH, course_id: MOS220 },
    ];
    fetchMock
      .mockResolvedValueOnce(reply(200, { valid: true, code: "GCP-ABCDE23456", percentOff: 10 }))
      .mockResolvedValueOnce(reply(200, { ok: true, status: "paid" }));

    const res = await checkout("GCP-ABCDE23456", [
      { product_id: PRODUCT, quantity: 1 },
      { product_id: BUNDLE, quantity: 1 },
    ]);
    expect(res.status).toBe(200);
    expect(evaluated().listPriceCents).toBe(50000);
    expect(inserted[0]).toMatchObject({ subtotal: 1100, discount_amount: 50, total: 1050 });
    // The bundle's courses were looked up along with the single course.
    expect(courseLookups[0][1]).toEqual(expect.arrayContaining(["c1", "c-mos100", MOS220]));
  });

  it("still discounts a bundle of eligible courses (the Mosaic Certification bundle)", async () => {
    const PATH = "77777777-7777-4777-8777-777777777777";
    cartProducts = [product(BUNDLE, "Mosaic Certification Bundle", 599, { learning_path_id: PATH })];
    pathItems = [
      { path_id: PATH, course_id: "c-mos100" },
      { path_id: PATH, course_id: "c-mos230" },
      { path_id: PATH, course_id: "c-mos240" },
    ];
    fetchMock
      .mockResolvedValueOnce(reply(200, { valid: true, code: "GCP-ABCDE23456", percentOff: 50 }))
      .mockResolvedValueOnce(reply(200, { ok: true, status: "paid" }));

    const res = await checkout("GCP-ABCDE23456", [{ product_id: BUNDLE, quantity: 1 }]);
    expect(res.status).toBe(200);
    expect(evaluated().listPriceCents).toBe(59900);
    expect(inserted[0]).toMatchObject({ subtotal: 599, discount_amount: 299.5, total: 299.5 });
    expect(inserted[0].metadata).not.toHaveProperty("partner_excluded_product_ids");
  });

  it("refuses the code (and asks no portal) when eligibility can't be read", async () => {
    coursesError = { message: "column courses.partner_code_eligible does not exist" };
    const res = await checkout("GCP-ABCDE23456");
    expect(res.status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(inserted).toHaveLength(0);
  });

  it("does not limit local coupons on the specialist courses", async () => {
    cartProducts = [SURVEYCRAFT_PRODUCT];
    localCoupon = { id: "cp1", code: "SPRING", discount_type: "percentage", discount_value: 10, is_active: true, current_uses: 0 };
    const res = await checkout("SPRING", [{ product_id: SURVEYCRAFT, quantity: 1 }]);
    expect(res.status).toBe(200);
    expect(inserted[0]).toMatchObject({ subtotal: 300, discount_amount: 30, total: 270 });
    expect(courseLookups).toHaveLength(0);
  });
});
