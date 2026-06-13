import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/service";
import { rateLimit } from "@/lib/rate-limit";

// Customer order history. A client looks up an order with their email + order
// number (proof of ownership); we then return that order plus any other orders
// placed from the same email in the same store — a lightweight account-free
// "my orders" view.
const schema = z.object({
  storefront_slug: z.string().min(1),
  email: z.string().email(),
  order_number: z.string().min(3).max(40),
});

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";
  const rl = await rateLimit(`order-lookup-${ip}`, 15, 60000);
  if (!rl.success) {
    return NextResponse.json({ error: "Too many attempts. Please wait a moment." }, { status: 429 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid lookup" }, { status: 400 });
  const { storefront_slug, email, order_number } = parsed.data;

  const service = createServiceClient();
  const { data: store } = await service
    .from("storefronts")
    .select("id")
    .eq("slug", storefront_slug)
    .single();
  if (!store) return NextResponse.json({ error: "Store not found" }, { status: 404 });

  const normalizedEmail = email.toLowerCase().trim();

  // Verify the email owns the named order before revealing anything.
  const { data: proof } = await service
    .from("orders")
    .select("id")
    .eq("storefront_id", store.id)
    .eq("order_number", order_number.trim().toUpperCase())
    .eq("customer_email", normalizedEmail)
    .maybeSingle();

  if (!proof) {
    return NextResponse.json(
      { error: "We couldn't find an order matching that number and email." },
      { status: 404 }
    );
  }

  const { data: orders } = await service
    .from("orders")
    .select(
      "order_number, status, company_name, customer_name, total, currency, po_number, created_at, items:order_items(product_name, price, quantity, product:products(name))"
    )
    .eq("storefront_id", store.id)
    .eq("customer_email", normalizedEmail)
    .order("created_at", { ascending: false })
    .limit(50);

  const shaped = (orders || []).map((o) => ({
    orderNumber: o.order_number,
    status: o.status,
    companyName: o.company_name,
    customerName: o.customer_name,
    total: Number(o.total),
    currency: o.currency,
    poNumber: o.po_number,
    createdAt: o.created_at,
    items: (o.items || []).map((it) => ({
      name: it.product_name || (it.product as { name?: string } | null)?.name || "Course",
      seats: it.quantity,
      price: Number(it.price),
    })),
  }));

  return NextResponse.json({ orders: shaped });
}
