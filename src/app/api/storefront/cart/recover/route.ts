import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

// Returns the stored cart for a recovery token so the client can restore it
// into the browser cart. Public, but the token is an unguessable secret.
export async function GET(request: NextRequest) {
  const token = new URL(request.url).searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

  const service = createServiceClient();
  const { data: cart } = await service
    .from("abandoned_carts")
    .select("items, storefront_id, recovered_at, storefront:storefronts(slug)")
    .eq("recovery_token", token)
    .maybeSingle();

  if (!cart) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const slug = (cart.storefront as { slug?: string } | null)?.slug;

  // Re-validate items against the live catalog so restored carts reflect
  // current pricing, seat limits, and availability.
  const items = Array.isArray(cart.items) ? cart.items : [];
  const ids = items.map((i: { product_id?: string }) => i.product_id).filter(Boolean);
  const { data: products } = ids.length
    ? await service
        .from("products")
        .select("id, name, price, discount_price, discount_ends_at, image_url, status, min_participants, max_participants")
        .eq("storefront_id", cart.storefront_id)
        .in("id", ids)
    : { data: [] };
  const map = new Map((products || []).map((p) => [p.id, p]));

  const restored = items
    .map((i: { product_id?: string; quantity?: number }) => {
      const p = i.product_id ? map.get(i.product_id) : null;
      if (!p || p.status !== "active") return null;
      const unit =
        p.discount_price != null &&
        (!p.discount_ends_at || new Date(p.discount_ends_at) > new Date())
          ? Number(p.discount_price)
          : Number(p.price);
      return {
        productId: p.id,
        name: p.name,
        price: unit,
        imageUrl: p.image_url,
        quantity: Math.max(i.quantity || 1, p.min_participants ?? 1),
        minSeats: p.min_participants ?? 1,
        maxSeats: p.max_participants ?? null,
      };
    })
    .filter(Boolean);

  return NextResponse.json({ slug, token, items: restored });
}
