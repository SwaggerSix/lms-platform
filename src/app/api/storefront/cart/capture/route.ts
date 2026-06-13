import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { createServiceClient } from "@/lib/supabase/service";
import { rateLimit } from "@/lib/rate-limit";

// Captures an in-progress cart against the client's email so an abandoned-cart
// recovery note can be sent later if no order follows. Best-effort and public;
// prices are recomputed from the database, never trusted from the client.

const schema = z.object({
  storefront_slug: z.string().min(1),
  email: z.string().email(),
  customer_name: z.string().max(200).optional(),
  company_name: z.string().max(200).optional(),
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
  const rl = await rateLimit(`cart-capture-${ip}`, 20, 60000);
  if (!rl.success) return NextResponse.json({ ok: false }, { status: 429 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });
  const body = parsed.data;

  const service = createServiceClient();
  const { data: store } = await service
    .from("storefronts")
    .select("id")
    .eq("slug", body.storefront_slug)
    .eq("is_active", true)
    .single();
  if (!store) return NextResponse.json({ ok: false }, { status: 404 });

  const { data: products } = await service
    .from("products")
    .select("id, name, price, discount_price, discount_ends_at, image_url")
    .eq("storefront_id", store.id)
    .in("id", body.items.map((i) => i.product_id));
  const map = new Map((products || []).map((p) => [p.id, p]));

  const items = body.items
    .map((i) => {
      const p = map.get(i.product_id);
      if (!p) return null;
      const unit =
        p.discount_price != null &&
        (!p.discount_ends_at || new Date(p.discount_ends_at) > new Date())
          ? Number(p.discount_price)
          : Number(p.price);
      return { product_id: p.id, name: p.name, price: unit, quantity: i.quantity, image_url: p.image_url };
    })
    .filter(Boolean) as { product_id: string; name: string; price: number; quantity: number; image_url: string | null }[];

  if (items.length === 0) return NextResponse.json({ ok: false }, { status: 400 });

  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const email = body.email.toLowerCase().trim();

  // Reuse an existing (un-recovered) token for this store+email so repeated
  // captures don't pile up rows.
  const { data: existing } = await service
    .from("abandoned_carts")
    .select("recovery_token")
    .eq("storefront_id", store.id)
    .eq("email", email)
    .maybeSingle();

  const recoveryToken = existing?.recovery_token || crypto.randomBytes(16).toString("hex");

  await service.from("abandoned_carts").upsert(
    {
      storefront_id: store.id,
      email,
      customer_name: body.customer_name?.trim() || null,
      company_name: body.company_name?.trim() || null,
      items,
      subtotal,
      recovery_token: recoveryToken,
      reminded_at: null,
      recovered_at: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "storefront_id,email" }
  );

  return NextResponse.json({ ok: true });
}
