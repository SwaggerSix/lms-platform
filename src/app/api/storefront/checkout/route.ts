import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/service";
import { rateLimit } from "@/lib/rate-limit";
import { generateOrderNumber } from "@/lib/ecommerce/pricing";
import {
  calculateStorefrontPricing,
  seatsWithinLimits,
  type VolumeTier,
} from "@/lib/storefront/pricing";
import { createCheckoutSession, isStripeConfigured } from "@/lib/storefront/stripe";
import { sendOrderEmails } from "@/lib/storefront/fulfillment";

// Public guest checkout for storefronts. Clients (organizations) order seats
// in courses for their employees. Validates the cart server-side (prices and
// seat limits always come from the database, never the client), creates a
// pending order, and hands off to Stripe Checkout for card payment. Without
// Stripe keys the order completes immediately in test mode.

const checkoutSchema = z.object({
  storefront_slug: z.string().min(1),
  customer_email: z.string().email(),
  customer_name: z.string().min(1).max(200),
  company_name: z.string().max(200).optional(),
  customer_phone: z.string().max(40).optional(),
  po_number: z.string().max(80).optional(),
  order_notes: z.string().max(2000).optional(),
  billing_address: z
    .object({
      line1: z.string().max(200).optional(),
      line2: z.string().max(200).optional(),
      city: z.string().max(120).optional(),
      state: z.string().max(120).optional(),
      postal_code: z.string().max(40).optional(),
      country: z.string().max(120).optional(),
    })
    .optional(),
  coupon_code: z.string().max(50).optional(),
  recovery_token: z.string().max(80).optional(),
  items: z
    .array(
      z.object({
        product_id: z.string().uuid(),
        quantity: z.number().int().min(1).max(10000),
      })
    )
    .min(1)
    .max(50),
});

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";
  const rl = await rateLimit(`storefront-checkout-${ip}`, 10, 60000);
  if (!rl.success) {
    return NextResponse.json({ error: "Too many requests. Please wait a moment." }, { status: 429 });
  }

  const parsed = checkoutSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid checkout details" }, { status: 400 });
  }
  const body = parsed.data;

  const service = createServiceClient();

  const { data: store } = await service
    .from("storefronts")
    .select(
      "id, slug, name, currency, is_active, volume_discounts_enabled, tax_enabled, tax_rate"
    )
    .eq("slug", body.storefront_slug)
    .eq("is_active", true)
    .single();
  if (!store) {
    return NextResponse.json({ error: "Store not found" }, { status: 404 });
  }

  const productIds = body.items.map((i) => i.product_id);
  const { data: products } = await service
    .from("products")
    .select(
      "id, name, description, image_url, price, discount_price, discount_ends_at, status, course_id, category, min_participants, max_participants"
    )
    .eq("storefront_id", store.id)
    .in("id", productIds);

  const productMap = new Map((products || []).map((p) => [p.id, p]));
  for (const item of body.items) {
    const p = productMap.get(item.product_id);
    if (!p || p.status !== "active") {
      return NextResponse.json(
        { error: "An item in your cart is no longer available. Please refresh and try again." },
        { status: 409 }
      );
    }
    // Enforce per-course seat (participant) limits.
    if (!seatsWithinLimits(item.quantity, p.min_participants ?? 1, p.max_participants ?? null)) {
      const max = p.max_participants ? `–${p.max_participants}` : "+";
      return NextResponse.json(
        {
          error: `"${p.name}" requires ${p.min_participants ?? 1}${max} seats per order. Please adjust the seat count.`,
        },
        { status: 400 }
      );
    }
  }

  const effectivePrice = (p: NonNullable<typeof products>[number]) =>
    p.discount_price != null &&
    (!p.discount_ends_at || new Date(p.discount_ends_at) > new Date())
      ? Number(p.discount_price)
      : Number(p.price);

  const lineItems = body.items.map((item) => {
    const p = productMap.get(item.product_id)!;
    return { product: p, unitPrice: effectivePrice(p), quantity: item.quantity };
  });

  // Quote-only items (no public price) cannot be checked out.
  if (lineItems.some((li) => li.unitPrice <= 0)) {
    return NextResponse.json(
      { error: "An item in your cart is priced on request. Please contact us to order it." },
      { status: 400 }
    );
  }

  // Volume discount tiers (only loaded/applied when the store enables them).
  let volumeTiers: VolumeTier[] = [];
  if (store.volume_discounts_enabled) {
    const { data: tiers } = await service
      .from("volume_discount_tiers")
      .select("min_seats, discount_percent, is_active")
      .eq("storefront_id", store.id)
      .eq("is_active", true);
    volumeTiers = tiers || [];
  }

  // Coupon (optional)
  let coupon = null;
  if (body.coupon_code) {
    const { data: c } = await service
      .from("coupons")
      .select("*")
      .eq("code", body.coupon_code.toUpperCase().trim())
      .eq("is_active", true)
      .single();
    const now = new Date();
    const valid =
      c &&
      (!c.max_uses || c.current_uses < c.max_uses) &&
      (!c.valid_from || new Date(c.valid_from) <= now) &&
      (!c.valid_until || new Date(c.valid_until) >= now);
    if (!valid) {
      return NextResponse.json({ error: "That discount code is not valid" }, { status: 400 });
    }
    const provisionalSubtotal = lineItems.reduce((s, li) => s + li.unitPrice * li.quantity, 0);
    if (c.min_purchase && provisionalSubtotal < Number(c.min_purchase)) {
      return NextResponse.json(
        { error: `That code requires a minimum purchase of $${c.min_purchase}` },
        { status: 400 }
      );
    }
    coupon = c;
  }

  const pricing = calculateStorefrontPricing(
    lineItems.map((li) => ({ unitPrice: li.unitPrice, quantity: li.quantity })),
    {
      volumeDiscountsEnabled: store.volume_discounts_enabled,
      volumeTiers,
      taxEnabled: store.tax_enabled,
      taxRate: Number(store.tax_rate || 0),
    },
    coupon
  );

  const testMode = !isStripeConfigured();
  const orderNumber = generateOrderNumber();
  const nowIso = new Date().toISOString();
  const initialStatus = testMode ? "completed" : "pending";

  const { data: order, error: orderError } = await service
    .from("orders")
    .insert({
      order_number: orderNumber,
      status: initialStatus,
      storefront_id: store.id,
      customer_email: body.customer_email.toLowerCase().trim(),
      customer_name: body.customer_name.trim(),
      company_name: body.company_name?.trim() || null,
      customer_phone: body.customer_phone?.trim() || null,
      po_number: body.po_number?.trim() || null,
      order_notes: body.order_notes?.trim() || null,
      billing_address: body.billing_address || null,
      subtotal: pricing.subtotal,
      discount_amount: pricing.discount,
      tax_amount: pricing.tax,
      total: pricing.total,
      currency: store.currency,
      payment_method: testMode ? "test_mode" : "card",
      status_history: [{ status: initialStatus, at: nowIso, by: "checkout" }],
      metadata: {
        storefront_slug: store.slug,
        volume_discount: pricing.volumeDiscount,
        coupon_discount: pricing.couponDiscount,
        ...(coupon && { coupon_id: coupon.id, coupon_code: coupon.code }),
        ...(testMode && { test_mode: true }),
      },
    })
    .select("id, order_number")
    .single();

  if (orderError || !order) {
    console.error("Storefront checkout: order insert failed:", orderError?.message);
    return NextResponse.json({ error: "Could not start checkout. Please try again." }, { status: 500 });
  }

  await service.from("order_items").insert(
    lineItems.map((li) => ({
      order_id: order.id,
      product_id: li.product.id,
      course_id: li.product.course_id,
      product_name: li.product.name,
      product_category: li.product.category,
      price: li.unitPrice,
      quantity: li.quantity,
    }))
  );

  // Mark a recovered abandoned cart (best-effort).
  if (body.recovery_token) {
    await service
      .from("abandoned_carts")
      .update({ recovered_at: nowIso })
      .eq("recovery_token", body.recovery_token);
  } else {
    await service
      .from("abandoned_carts")
      .update({ recovered_at: nowIso })
      .eq("storefront_id", store.id)
      .eq("email", body.customer_email.toLowerCase().trim())
      .is("recovered_at", null);
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
  const successUrl = `${appUrl}/store/${store.slug}/success?order=${order.order_number}`;

  if (testMode) {
    if (coupon) {
      await service
        .from("coupons")
        .update({ current_uses: coupon.current_uses + 1 })
        .eq("id", coupon.id);
    }
    await sendOrderEmails(service, order.id, appUrl);
    return NextResponse.json({ checkout_url: successUrl, test_mode: true });
  }

  try {
    const session = await createCheckoutSession({
      lineItems: lineItems.map((li) => ({
        name: li.product.name || "Course",
        description: li.product.description?.slice(0, 200) || undefined,
        imageUrl: li.product.image_url || undefined,
        unitAmountCents: Math.round(li.unitPrice * 100),
        quantity: li.quantity,
      })),
      currency: store.currency,
      customerEmail: body.customer_email,
      orderId: order.id,
      orderNumber: order.order_number,
      successUrl,
      cancelUrl: `${appUrl}/store/${store.slug}/cart?canceled=1`,
      // Stripe coupon shows the combined volume + coupon discount on its page.
      discountCents: Math.round(pricing.discount * 100),
    });

    await service
      .from("orders")
      .update({ stripe_session_id: session.id })
      .eq("id", order.id);

    return NextResponse.json({ checkout_url: session.url });
  } catch (err) {
    console.error("Storefront checkout: Stripe session failed:", err);
    await service.from("orders").update({ status: "failed" }).eq("id", order.id);
    return NextResponse.json(
      { error: "Payment service is unavailable right now. Please try again shortly." },
      { status: 502 }
    );
  }
}
