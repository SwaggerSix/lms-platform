import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { verifyWebhookSignature } from "@/lib/storefront/stripe";
import { sendOrderEmails } from "@/lib/storefront/fulfillment";

// Stripe webhook: marks orders paid when Stripe confirms payment, then
// fulfills them (sales counts, coupon usage, auto-enrollment for buyers who
// already have an LMS account with the same email).

export async function POST(request: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }

  const payload = await request.text();
  const event = verifyWebhookSignature(
    payload,
    request.headers.get("stripe-signature"),
    secret
  );
  if (!event) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (
    event.type !== "checkout.session.completed" &&
    event.type !== "checkout.session.async_payment_succeeded"
  ) {
    return NextResponse.json({ received: true });
  }

  const session = event.data.object as {
    id: string;
    payment_intent?: string | null;
    payment_status?: string;
    metadata?: { order_id?: string };
  };
  if (session.payment_status && session.payment_status !== "paid") {
    return NextResponse.json({ received: true });
  }

  const orderId = session.metadata?.order_id;
  const service = createServiceClient();

  const orderQuery = service
    .from("orders")
    .select("id, status, customer_email, metadata, status_history")
    .limit(1);
  const { data: orders } = orderId
    ? await orderQuery.eq("id", orderId)
    : await orderQuery.eq("stripe_session_id", session.id);
  const order = orders?.[0];

  if (!order) {
    console.error("Storefront webhook: no order for session", session.id);
    return NextResponse.json({ received: true });
  }
  if (order.status === "completed") {
    // Stripe retries webhooks; fulfillment is idempotent.
    return NextResponse.json({ received: true });
  }

  const completedAt = new Date().toISOString();
  const history = Array.isArray((order as { status_history?: unknown }).status_history)
    ? ((order as { status_history: unknown[] }).status_history as unknown[])
    : [];
  await service
    .from("orders")
    .update({
      status: "completed",
      payment_intent_id: session.payment_intent || null,
      status_history: [...history, { status: "completed", at: completedAt, by: "stripe" }],
      updated_at: completedAt,
    })
    .eq("id", order.id);

  const { data: items } = await service
    .from("order_items")
    .select("product_id, course_id, quantity")
    .eq("order_id", order.id);

  for (const item of items || []) {
    const { data: product } = await service
      .from("products")
      .select("sales_count")
      .eq("id", item.product_id)
      .single();
    if (product) {
      await service
        .from("products")
        .update({ sales_count: product.sales_count + item.quantity })
        .eq("id", item.product_id);
    }
  }

  const couponId = (order.metadata as { coupon_id?: string } | null)?.coupon_id;
  if (couponId) {
    const { data: coupon } = await service
      .from("coupons")
      .select("current_uses")
      .eq("id", couponId)
      .single();
    if (coupon) {
      await service
        .from("coupons")
        .update({ current_uses: coupon.current_uses + 1 })
        .eq("id", couponId);
    }
  }

  // Auto-enroll buyers who already have an LMS account with this email
  if (order.customer_email) {
    const { data: user } = await service
      .from("users")
      .select("id")
      .eq("email", order.customer_email)
      .single();
    if (user) {
      const courseIds = (items || [])
        .map((i) => i.course_id)
        .filter((id): id is string => Boolean(id));
      for (const courseId of courseIds) {
        await service
          .from("enrollments")
          .upsert(
            {
              user_id: user.id,
              course_id: courseId,
              status: "active",
              enrolled_at: new Date().toISOString(),
            },
            { onConflict: "user_id,course_id", ignoreDuplicates: true }
          );
      }
    }
  }

  // Buyer confirmation + internal new-order notification.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
  await sendOrderEmails(service, order.id, appUrl);

  return NextResponse.json({ received: true });
}
