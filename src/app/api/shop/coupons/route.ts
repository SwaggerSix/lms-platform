import { authorize } from "@/lib/auth/authorize";
import { createServiceClient } from "@/lib/supabase/service";
import { NextRequest, NextResponse } from "next/server";
import { validateBody, createCouponSchema } from "@/lib/validations";
import { rateLimit } from "@/lib/rate-limit";

export async function GET() {
  const auth = await authorize("super_admin");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const service = createServiceClient();
  const { data, error } = await service
    .from("coupons")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Coupons GET error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  // Store products a code can be limited to (Coupons → "Only for product").
  const { data: products } = await service
    .from("products")
    .select("id, name, learning_path_id, storefront:storefronts(name)")
    .not("storefront_id", "is", null)
    .order("name")
    .limit(1000);

  return NextResponse.json({
    coupons: data,
    products: (products || []).map((p) => {
      const store = Array.isArray(p.storefront) ? p.storefront[0] : p.storefront;
      return {
        id: p.id,
        name: p.name,
        store: (store as { name?: string } | null)?.name ?? null,
        is_bundle: Boolean(p.learning_path_id),
      };
    }),
  });
}

export async function POST(request: NextRequest) {
  const auth = await authorize("super_admin");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const rl = await rateLimit(`coupon-create-${auth.user.id}`, 20, 60000);
  if (!rl.success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const body = await request.json().catch(() => null);
  const validation = validateBody(createCouponSchema, body);
  if (!validation.success) return NextResponse.json({ error: validation.error }, { status: 400 });

  const service = createServiceClient();

  if (validation.data.product_id) {
    const { data: product } = await service
      .from("products")
      .select("id")
      .eq("id", validation.data.product_id)
      .maybeSingle();
    if (!product) {
      return NextResponse.json({ error: "That product no longer exists" }, { status: 400 });
    }
  }

  const insertData = {
    ...validation.data,
    code: validation.data.code.toUpperCase().trim(),
    product_id: validation.data.product_id || null,
    created_by: auth.user.id,
  };

  const { data, error } = await service.from("coupons").insert(insertData).select().single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "A coupon with this code already exists" }, { status: 409 });
    }
    console.error("Coupon create error:", error.message);
    return NextResponse.json({ error: "Failed to create coupon" }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
