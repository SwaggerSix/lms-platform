import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authorize } from "@/lib/auth/authorize";
import { createServiceClient } from "@/lib/supabase/service";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const auth = await authorize("super_admin");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await context.params;

  const service = createServiceClient();
  const { data, error } = await service
    .from("volume_discount_tiers")
    .select("*")
    .eq("storefront_id", id)
    .order("min_seats");
  if (error) return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  return NextResponse.json({ tiers: data });
}

const tierSchema = z.object({
  min_seats: z.number().int().min(2).max(100000),
  discount_percent: z.number().min(0.01).max(100),
  is_active: z.boolean().optional(),
});

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await authorize("super_admin");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await context.params;

  const parsed = tierSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid tier" }, { status: 400 });
  }

  const service = createServiceClient();
  const { data, error } = await service
    .from("volume_discount_tiers")
    .insert({ ...parsed.data, storefront_id: id })
    .select("*")
    .single();
  if (error) {
    const msg = error.message.includes("duplicate")
      ? "A tier with that seat threshold already exists"
      : "Could not create the tier";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  return NextResponse.json({ tier: data }, { status: 201 });
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const auth = await authorize("super_admin");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await context.params;
  const tierId = new URL(request.url).searchParams.get("tier_id");
  if (!tierId) return NextResponse.json({ error: "Missing tier id" }, { status: 400 });

  const service = createServiceClient();
  const { error } = await service
    .from("volume_discount_tiers")
    .delete()
    .eq("id", tierId)
    .eq("storefront_id", id);
  if (error) return NextResponse.json({ error: "Could not delete the tier" }, { status: 400 });
  return NextResponse.json({ deleted: true });
}
