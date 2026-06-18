import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authorize } from "@/lib/auth/authorize";
import { createServiceClient } from "@/lib/supabase/service";
import { refundPayment, isStripeConfigured } from "@/lib/storefront/stripe";
import { enqueueOrderRefunded } from "@/lib/integrations/qbo-sync";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const auth = await authorize("super_admin");
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { id } = await context.params;

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const status = searchParams.get("status");
  const limit = 25;

  const service = createServiceClient();
  let query = service
    .from("orders")
    .select(
      "id, order_number, status, customer_email, customer_name, company_name, customer_phone, po_number, order_notes, admin_notes, payment_method, payment_intent_id, subtotal, discount_amount, tax_amount, total, refunded_amount, currency, created_at, status_history, items:order_items(id, price, quantity, product_name, product:products(name))",
      { count: "exact" }
    )
    .eq("storefront_id", id)
    .order("created_at", { ascending: false })
    .range((page - 1) * limit, page * limit - 1);

  if (status && status !== "all") query = query.eq("status", status);

  const { data, count, error } = await query;
  if (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
  return NextResponse.json({
    orders: data,
    total: count,
    page,
    totalPages: Math.ceil((count || 0) / limit),
  });
}

const patchSchema = z.object({
  order_id: z.string().uuid(),
  status: z
    .enum(["pending", "completed", "refunded", "partially_refunded", "cancelled", "failed"])
    .optional(),
  admin_notes: z.string().max(5000).nullable().optional(),
  refund_amount: z.number().min(0).max(9999999).optional(),
});

export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = await authorize("super_admin");
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { id } = await context.params;

  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid order update" }, { status: 400 });
  }
  const body = parsed.data;

  const service = createServiceClient();
  const { data: order } = await service
    .from("orders")
    .select("id, status, total, refunded_amount, payment_intent_id, status_history")
    .eq("id", body.order_id)
    .eq("storefront_id", id)
    .single();
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if ("admin_notes" in body) update.admin_notes = body.admin_notes;

  // Process a refund through Stripe when an amount is given and the order was
  // actually paid by card. Test-mode orders just record the refund state.
  if (body.refund_amount && body.refund_amount > 0) {
    const already = Number(order.refunded_amount || 0);
    const refundable = Number(order.total) - already;
    if (body.refund_amount > refundable + 0.001) {
      return NextResponse.json(
        { error: `Refund exceeds the remaining refundable amount (${refundable.toFixed(2)}).` },
        { status: 400 }
      );
    }
    if (order.payment_intent_id && isStripeConfigured()) {
      try {
        await refundPayment(order.payment_intent_id, Math.round(body.refund_amount * 100));
      } catch (err) {
        console.error("Refund failed:", err);
        return NextResponse.json({ error: "Stripe refund failed. Please try again." }, { status: 502 });
      }
    }
    const newRefunded = Math.round((already + body.refund_amount) * 100) / 100;
    update.refunded_amount = newRefunded;
    update.status = newRefunded >= Number(order.total) - 0.001 ? "refunded" : "partially_refunded";
  } else if (body.status) {
    update.status = body.status;
  }

  if (update.status && update.status !== order.status) {
    const history = Array.isArray(order.status_history) ? order.status_history : [];
    update.status_history = [
      ...history,
      { status: update.status, at: new Date().toISOString(), by: auth.user?.id || "admin" },
    ];
  }

  const { data: updated, error } = await service
    .from("orders")
    .update(update)
    .eq("id", body.order_id)
    .eq("storefront_id", id)
    .select("id, status, refunded_amount, admin_notes")
    .single();

  if (error || !updated) {
    return NextResponse.json({ error: "Could not update the order" }, { status: 400 });
  }

  // Capture the refund for QuickBooks (Refund Receipt / Credit Memo). Uses the
  // cumulative refunded amount so partial refunds each enqueue a distinct
  // event. Non-fatal — never block the refund response on the QB enqueue.
  if (body.refund_amount && body.refund_amount > 0) {
    await enqueueOrderRefunded(
      service,
      body.order_id,
      Number(updated.refunded_amount ?? 0)
    );
  }

  return NextResponse.json({ order: updated });
}
