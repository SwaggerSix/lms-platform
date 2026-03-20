import { authorize } from "@/lib/auth/authorize";
import { createServiceClient } from "@/lib/supabase/service";
import { NextRequest, NextResponse } from "next/server";
import { validateBody, checkoutSchema } from "@/lib/validations";
import { rateLimit } from "@/lib/rate-limit";
import {
  calculateOrderTotal,
  validateCoupon,
  generateOrderNumber,
} from "@/lib/ecommerce/pricing";

export async function POST(request: NextRequest) {
  const auth = await authorize("admin", "manager", "instructor", "learner");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const rl = await rateLimit(`checkout-${auth.user.id}`, 5, 60000);
  if (!rl.success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const body = await request.json();
  const validation = validateBody(checkoutSchema, body);
  if (!validation.success) return NextResponse.json({ error: validation.error }, { status: 400 });

  const service = createServiceClient();

  // Get cart items with product + course info
  const { data: cartItems, error: cartError } = await service
    .from("cart_items")
    .select("*, product:products(*, course:courses(id, title, instructor_id))")
    .eq("user_id", auth.user.id);

  if (cartError) {
    console.error("Checkout cart error:", cartError.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  if (!cartItems || cartItems.length === 0) {
    return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
  }

  // Validate coupon if provided
  let coupon = null;
  if (validation.data.coupon_code) {
    const couponResult = await validateCoupon(validation.data.coupon_code, auth.user.id);
    if (!couponResult.valid) {
      return NextResponse.json({ error: couponResult.reason }, { status: 400 });
    }
    coupon = couponResult.coupon!;
  }

  // Build line items, applying discount prices where active
  const now = new Date();
  const lineItems = cartItems.map((item: any) => {
    const product = item.product;
    let effectivePrice = product.price;
    if (
      product.discount_price != null &&
      product.discount_ends_at &&
      new Date(product.discount_ends_at) > now
    ) {
      effectivePrice = product.discount_price;
    }
    return {
      product_id: product.id,
      course_id: product.course.id,
      price: effectivePrice,
      quantity: 1,
      instructor_id: product.course.instructor_id,
    };
  });

  // Check min_purchase for coupon
  const totals = calculateOrderTotal(lineItems, coupon);
  if (coupon && coupon.min_purchase && totals.subtotal < coupon.min_purchase) {
    return NextResponse.json(
      { error: `Minimum purchase of ${coupon.min_purchase} required for this coupon` },
      { status: 400 }
    );
  }

  // Create order
  const orderNumber = generateOrderNumber();
  const { data: order, error: orderError } = await service
    .from("orders")
    .insert({
      user_id: auth.user.id,
      order_number: orderNumber,
      status: "completed", // Simulated payment — auto-complete
      subtotal: totals.subtotal,
      discount_amount: totals.discount,
      tax_amount: totals.tax,
      total: totals.total,
      currency: "USD",
      payment_method: validation.data.payment_method,
      metadata: coupon ? { coupon_id: coupon.id, coupon_code: coupon.code } : {},
    })
    .select()
    .single();

  if (orderError) {
    console.error("Order create error:", orderError.message);
    return NextResponse.json({ error: "Failed to create order" }, { status: 500 });
  }

  // Create order items
  const orderItems = lineItems.map((li: any) => ({
    order_id: order.id,
    product_id: li.product_id,
    course_id: li.course_id,
    price: li.price,
    quantity: li.quantity,
  }));

  const { error: itemsError } = await service.from("order_items").insert(orderItems);
  if (itemsError) {
    console.error("Order items error:", itemsError.message);
  }

  // Update coupon usage
  if (coupon) {
    await service
      .from("coupons")
      .update({ current_uses: coupon.current_uses + 1 })
      .eq("id", coupon.id);
  }

  // Update sales counts
  for (const li of lineItems) {
    const { data: prod } = await service.from("products").select("sales_count").eq("id", li.product_id).single();
    if (prod) {
      await service.from("products").update({ sales_count: (prod.sales_count || 0) + 1 }).eq("id", li.product_id);
    }
  }

  // Auto-enroll user in purchased courses
  const enrollments = lineItems.map((li: any) => ({
    user_id: auth.user.id,
    course_id: li.course_id,
    status: "active",
    enrolled_at: new Date().toISOString(),
  }));

  const { error: enrollError } = await service.from("enrollments").upsert(enrollments, {
    onConflict: "user_id,course_id",
    ignoreDuplicates: true,
  });
  if (enrollError) {
    console.error("Auto-enroll error:", enrollError.message);
  }

  // Create instructor payouts
  const payouts = lineItems
    .filter((li: any) => li.instructor_id)
    .map((li: any) => ({
      instructor_id: li.instructor_id,
      order_id: order.id,
      amount: Math.round(li.price * 0.70 * 100) / 100,
      commission_rate: 70.0,
      status: "pending",
    }));

  if (payouts.length > 0) {
    await service.from("instructor_payouts").insert(payouts);
  }

  // Clear cart
  await service.from("cart_items").delete().eq("user_id", auth.user.id);

  return NextResponse.json({
    order: {
      ...order,
      items: orderItems,
    },
    message: "Order completed successfully. You are now enrolled in your purchased courses.",
  }, { status: 201 });
}
