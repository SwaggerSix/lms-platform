import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/auth/authorize";
import { createServiceClient } from "@/lib/supabase/service";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await authorize("super_admin");
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { id } = await context.params;

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit = 25;

  const service = createServiceClient();
  const { data, count, error } = await service
    .from("orders")
    .select("id, order_number, status, customer_email, customer_name, total, currency, payment_method, created_at, items:order_items(id, price, quantity, product:products(name))", { count: "exact" })
    .eq("storefront_id", id)
    .order("created_at", { ascending: false })
    .range((page - 1) * limit, page * limit - 1);

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
