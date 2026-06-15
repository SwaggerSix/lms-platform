import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authorize } from "@/lib/auth/authorize";
import { createServiceClient } from "@/lib/supabase/service";

const productSchema = z.object({
  name: z.string().min(1).max(250),
  description: z.string().max(5000).nullable().optional(),
  price: z.number().min(0).max(999999),
  discount_price: z.number().min(0).max(999999).nullable().optional(),
  category: z.string().max(120).nullable().optional(),
  categories: z.array(z.string().max(120)).max(20).optional(),
  duration_label: z.string().max(80).nullable().optional(),
  delivery_formats: z.array(z.string().max(60)).max(10).optional(),
  image_url: z.string().url().nullable().optional().or(z.literal("")),
  image_urls: z.array(z.string().url()).max(10).optional(),
  logistics: z
    .object({
      lead_time: z.string().max(200).optional(),
      coordinator_email: z.string().max(200).optional(),
      coordinator_phone: z.string().max(60).optional(),
      notes: z.string().max(2000).optional(),
    })
    .optional(),
  min_participants: z.number().int().min(1).max(10000).optional(),
  max_participants: z.number().int().min(1).max(10000).nullable().optional(),
  sku: z.string().max(80).nullable().optional(),
  status: z.enum(["active", "inactive", "coming_soon"]).optional(),
  is_featured: z.boolean().optional(),
  listed_in_storefront: z.boolean().optional(),
  nasba_certified: z.boolean().optional(),
  nasba_cpe_credits: z.number().min(0).max(999).nullable().optional(),
  nasba_field_of_study: z.string().max(200).nullable().optional(),
  nasba_knowledge_level: z.enum(["Basic", "Overview", "Intermediate", "Advanced", "Update"]).nullable().optional(),
  nasba_prerequisites: z.string().max(2000).nullable().optional(),
  nasba_advance_prep: z.string().max(2000).nullable().optional(),
  nasba_delivery_method: z.string().max(200).nullable().optional(),
  course_id: z.string().uuid().nullable().optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const auth = await authorize("super_admin");
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { id } = await context.params;

  const service = createServiceClient();
  const { data, error } = await service
    .from("products")
    .select("*, course:courses(id, title)")
    .eq("storefront_id", id)
    .order("category", { ascending: true, nullsFirst: false })
    .order("sort_order")
    .order("name");

  if (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
  return NextResponse.json({ products: data });
}

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await authorize("super_admin");
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { id } = await context.params;

  const parsed = productSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid product details" },
      { status: 400 }
    );
  }

  const service = createServiceClient();
  const { data, error } = await service
    .from("products")
    .insert({
      ...parsed.data,
      image_url: parsed.data.image_url || null,
      storefront_id: id,
      status: parsed.data.status || "active",
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: "Could not create the product" }, { status: 400 });
  }
  return NextResponse.json({ product: data }, { status: 201 });
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const auth = await authorize("super_admin");
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { id } = await context.params;

  const body = await request.json().catch(() => null);
  const productId = body?.product_id;
  if (!productId || typeof productId !== "string") {
    return NextResponse.json({ error: "Missing product id" }, { status: 400 });
  }
  const parsed = productSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid product details" },
      { status: 400 }
    );
  }

  const update: Record<string, unknown> = {
    ...parsed.data,
    updated_at: new Date().toISOString(),
  };
  if ("image_url" in parsed.data) update.image_url = parsed.data.image_url || null;

  const service = createServiceClient();
  const { data, error } = await service
    .from("products")
    .update(update)
    .eq("id", productId)
    .eq("storefront_id", id)
    .select("*")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Could not update the product" }, { status: 400 });
  }
  return NextResponse.json({ product: data });
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const auth = await authorize("super_admin");
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { id } = await context.params;
  const productId = new URL(request.url).searchParams.get("product_id");
  if (!productId) {
    return NextResponse.json({ error: "Missing product id" }, { status: 400 });
  }

  const service = createServiceClient();

  // Keep purchase history intact: products that have been ordered are
  // archived (hidden from the store) instead of deleted.
  const { data: ordered } = await service
    .from("order_items")
    .select("id")
    .eq("product_id", productId)
    .limit(1);

  if (ordered && ordered.length > 0) {
    await service
      .from("products")
      .update({ status: "inactive", updated_at: new Date().toISOString() })
      .eq("id", productId)
      .eq("storefront_id", id);
    return NextResponse.json({ archived: true });
  }

  const { error } = await service
    .from("products")
    .delete()
    .eq("id", productId)
    .eq("storefront_id", id);
  if (error) {
    return NextResponse.json({ error: "Could not delete the product" }, { status: 400 });
  }
  return NextResponse.json({ deleted: true });
}
