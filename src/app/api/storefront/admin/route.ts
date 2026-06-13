import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authorize } from "@/lib/auth/authorize";
import { createServiceClient } from "@/lib/supabase/service";

const storefrontSchema = z.object({
  slug: z
    .string()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9-]+$/, "Use only lowercase letters, numbers, and dashes"),
  name: z.string().min(1).max(120),
  tagline: z.string().max(200).nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  logo_url: z.string().url().nullable().optional().or(z.literal("")),
  hero_image_url: z.string().url().nullable().optional().or(z.literal("")),
  branding: z
    .object({
      primary_color: z.string().max(20).optional(),
      accent_color: z.string().max(20).optional(),
    })
    .optional(),
  contact_email: z.string().email().nullable().optional().or(z.literal("")),
  announcement: z.string().max(300).nullable().optional(),
  is_active: z.boolean().optional(),
  // B2B commerce settings
  order_notify_email: z.string().email().nullable().optional().or(z.literal("")),
  volume_discounts_enabled: z.boolean().optional(),
  tax_enabled: z.boolean().optional(),
  tax_rate: z.number().min(0).max(1).optional(),
  tax_label: z.string().max(40).optional(),
  analytics_measurement_id: z.string().max(40).nullable().optional().or(z.literal("")),
});

export async function GET() {
  const auth = await authorize("super_admin");
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const service = createServiceClient();
  const { data: stores, error } = await service
    .from("storefronts")
    .select("*")
    .order("created_at");
  if (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  // Lightweight per-store stats for the dashboard cards
  const { data: products } = await service
    .from("products")
    .select("storefront_id")
    .not("storefront_id", "is", null);
  const { data: orders } = await service
    .from("orders")
    .select("storefront_id, total, status")
    .not("storefront_id", "is", null);

  const stats: Record<string, { products: number; orders: number; revenue: number }> = {};
  for (const s of stores || []) stats[s.id] = { products: 0, orders: 0, revenue: 0 };
  for (const p of products || []) {
    if (p.storefront_id && stats[p.storefront_id]) stats[p.storefront_id].products++;
  }
  for (const o of orders || []) {
    if (o.storefront_id && stats[o.storefront_id] && o.status === "completed") {
      stats[o.storefront_id].orders++;
      stats[o.storefront_id].revenue += Number(o.total);
    }
  }

  return NextResponse.json({ storefronts: stores, stats });
}

export async function POST(request: NextRequest) {
  const auth = await authorize("super_admin");
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const parsed = storefrontSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid store details" },
      { status: 400 }
    );
  }

  const service = createServiceClient();
  const { data, error } = await service
    .from("storefronts")
    .insert({ ...parsed.data, logo_url: parsed.data.logo_url || null, hero_image_url: parsed.data.hero_image_url || null, contact_email: parsed.data.contact_email || null })
    .select("*")
    .single();

  if (error) {
    const msg = error.message.includes("duplicate")
      ? "A store with that web address already exists"
      : "Could not create the store";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  return NextResponse.json({ storefront: data }, { status: 201 });
}

export async function PUT(request: NextRequest) {
  const auth = await authorize("super_admin");
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json().catch(() => null);
  const id = body?.id;
  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "Missing store id" }, { status: 400 });
  }
  const parsed = storefrontSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid store details" },
      { status: 400 }
    );
  }

  const service = createServiceClient();
  const { data, error } = await service
    .from("storefronts")
    .update({
      ...parsed.data,
      logo_url: parsed.data.logo_url || null,
      hero_image_url: parsed.data.hero_image_url || null,
      contact_email: parsed.data.contact_email || null,
      ...("order_notify_email" in parsed.data && {
        order_notify_email: parsed.data.order_notify_email || null,
      }),
      ...("analytics_measurement_id" in parsed.data && {
        analytics_measurement_id: parsed.data.analytics_measurement_id || null,
      }),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Could not update the store" }, { status: 400 });
  }
  return NextResponse.json({ storefront: data });
}
