import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/service";
import { rateLimit } from "@/lib/rate-limit";
import { calculateOrderTotal, generateOrderNumber } from "@/lib/ecommerce/pricing";
import { createCheckoutSession, isStripeConfigured } from "@/lib/storefront/stripe";

// Public guest checkout for storefronts. Validates the cart server-side
// (prices always come from the database, never the client), creates a
// pending order, and hands off to Stripe Checkout. Without Stripe keys the
// order completes immediately in test mode so the store can be trialled.

const checkoutSchema = z.object({
  storefront_slug: z.string().min(1),
  customer_email: z.string().email(),
  customer_name: z.string().min(1).max(200),
  coupon_code: z.string().max(50).optional(),
  items: z
    .array(
      z.object({
        product_id: z.string().uuid(),
        quantity: z.number().int().min(1).max(50),
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
    .select("id, slug, name, currency, is_active")
    .eq("slug", body.storefront_slug)
    .eq("is_active", true)
    .single();
  if (!store) {
    return NextResponse.json({ error: "Store not found" }, { status: 404 });
  }

  const productIds = body.items.map((i) => i.product_id);
  const { data: products } = await service
    .from("products")
    .select("id, name, description, image_url, price, discount_price, discount_ends_at, status, course_id")
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
  }

  const effectivePrice = (p: NonNullable<typeof products>[number]) =>
    p.discount_price != null &&
    (!p.discount_ends_at || new Date(p.discount_ends_at) > new Date())
      ? Number(p.discount_price)
      : Number(p.price);

  const lineItems = body.items.map((item) => {
    const p = productMap.get(item.product_id)!;
    return { product: p, price: effectivePrice(p), quantity: item.quantity };
  });

  // Quote-only items (no public price) cannot be checked out
  if (lineItems.some((li) => li.price <= 0)) {
    return NextResponse.json(
      { error: "An item in your cart is priced on request. Please contact us to order it." },
      { status: 400 }
    );
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
    const subtotal = lineItems.reduce((s, li) => s + li.price * li.quantity, 0);
    if (c.min_purchase && subtotal < Number(c.min_purchase)) {
      return NextResponse.json(
        { error: `That code requires a minimum purchase of $${c.min_purchase}` },
        { status: 400 }
      );
    }
    coupon = c;
  }

  const totals = calculateOrderTotal(
    lineItems.map((li) => ({ price: li.price, quantity: li.quantity })),
    coupon
  );

  const testMode = !isStripeConfigured();
  const orderNumber = generateOrderNumber();

  const { data: order, error: orderError } = await service
    .from("orders")
    .insert({
      order_number: orderNumber,
      status: testMode ? "completed" : "pending",
      storefront_id: store.id,
      customer_email: body.customer_email.toLowerCase().trim(),
      customer_name: body.customer_name.trim(),
      subtotal: totals.subtotal,
      discount_amount: totals.discount,
      tax_amount: totals.tax,
      total: totals.total,
      currency: store.currency,
      payment_method: testMode ? "test_mode" : "card",
      metadata: {
        storefront_slug: store.slug,
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
      price: li.price,
      quantity: li.quantity,
    }))
  );

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
  const successUrl = `${appUrl}/store/${store.slug}/success?order=${order.order_number}`;

  if (testMode) {
    if (coupon) {
      await service
        .from("coupons")
        .update({ current_uses: coupon.current_uses + 1 })
        .eq("id", coupon.id);
    }
    return NextResponse.json({ checkout_url: successUrl, test_mode: true });
  }

  try {
    const session = await createCheckoutSession({
      lineItems: lineItems.map((li) => ({
        name: li.product.name || "Course",
        description: li.product.description?.slice(0, 200) || undefined,
        imageUrl: li.product.image_url || undefined,
        unitAmountCents: Math.round(li.price * 100),
        quantity: li.quantity,
      })),
      currency: store.currency,
      customerEmail: body.customer_email,
      orderId: order.id,
      orderNumber: order.order_number,
      successUrl,
      cancelUrl: `${appUrl}/store/${store.slug}/cart?canceled=1`,
      discountCents: Math.round(totals.discount * 100),
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
