import { authorize } from "@/lib/auth/authorize";
import { createServiceClient } from "@/lib/supabase/service";
import { NextRequest, NextResponse } from "next/server";
import { validateBody, updateOrderSchema } from "@/lib/validations";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorize("admin", "manager", "instructor", "learner");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const service = createServiceClient();

  const { data: order, error } = await service
    .from("orders")
    .select("*, order_items(*, product:products(*, course:courses(id, title, thumbnail_url, short_description)))")
    .eq("id", id)
    .single();

  if (error || !order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  // Non-admin can only see their own orders
  const isAdmin = auth.user.role === "admin" || auth.user.role === "manager";
  if (!isAdmin && order.user_id !== auth.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(order);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorize("admin");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const body = await request.json();
  const validation = validateBody(updateOrderSchema, body);
  if (!validation.success) return NextResponse.json({ error: validation.error }, { status: 400 });

  const service = createServiceClient();

  // Get existing order
  const { data: existing } = await service
    .from("orders")
    .select("*, order_items(*, product:products(course_id))")
    .eq("id", id)
    .single();

  if (!existing) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  // If refunding, handle enrollment removal
  if (validation.data.status === "refunded" && existing.status === "completed") {
    for (const item of existing.order_items || []) {
      await service
        .from("enrollments")
        .delete()
        .eq("user_id", existing.user_id)
        .eq("course_id", item.product?.course_id || item.course_id);
    }

    // Cancel payouts
    await service
      .from("instructor_payouts")
      .update({ status: "cancelled" })
      .eq("order_id", id);
  }

  const { data, error } = await service
    .from("orders")
    .update({ status: validation.data.status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Order update error:", error.message);
    return NextResponse.json({ error: "Failed to update order" }, { status: 500 });
  }

  return NextResponse.json(data);
}
