import { authorize } from "@/lib/auth/authorize";
import { createServiceClient } from "@/lib/supabase/service";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateBody, createCouponSchema, updateCouponSchema } from "@/lib/validations";
import { rateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";

// Admin → eCommerce → Coupons: edit (and the Active/Inactive toggle) and
// delete one coupon. super_admin only, like the list and create routes.
// `current_uses` is never written here: it is counted by checkout.

type Params = { params: Promise<{ id: string }> };

const EDITABLE = [
  "code",
  "discount_type",
  "discount_value",
  "max_uses",
  "min_purchase",
  "valid_from",
  "valid_until",
  "is_active",
  "product_id",
] as const;

function badId(id: string) {
  return !z.string().uuid().safeParse(id).success;
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = await authorize("super_admin");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  if (badId(id)) return NextResponse.json({ error: "Coupon not found" }, { status: 404 });

  const rl = await rateLimit(`coupon-edit-${auth.user.id}`, 60, 60000);
  if (!rl.success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const body = await request.json().catch(() => null);
  const validation = validateBody(updateCouponSchema, body);
  if (!validation.success) return NextResponse.json({ error: validation.error }, { status: 400 });

  const service = createServiceClient();
  const { data: existing, error: readError } = await service
    .from("coupons")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (readError) {
    console.error("Coupon read error:", readError.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
  if (!existing) return NextResponse.json({ error: "Coupon not found" }, { status: 404 });

  // Re-check the coupon as it will be after the change, with the same rules
  // as creating one (e.g. switching to "percentage" with a value of 150).
  const merged: Record<string, unknown> = {};
  for (const key of EDITABLE) merged[key] = existing[key];
  for (const discountKey of ["discount_value", "min_purchase"] as const) {
    // NUMERIC columns can come back as strings.
    if (merged[discountKey] !== null && merged[discountKey] !== undefined) {
      merged[discountKey] = Number(merged[discountKey]);
    }
  }
  Object.assign(merged, validation.data);
  const full = validateBody(createCouponSchema, merged);
  if (!full.success) return NextResponse.json({ error: full.error }, { status: 400 });

  const changes: Record<string, unknown> = { ...validation.data };
  if (typeof changes.code === "string") changes.code = changes.code.toUpperCase().trim();
  if ("product_id" in changes) changes.product_id = changes.product_id || null;

  if (changes.product_id && changes.product_id !== existing.product_id) {
    const { data: product } = await service
      .from("products")
      .select("id")
      .eq("id", changes.product_id as string)
      .maybeSingle();
    if (!product) {
      return NextResponse.json({ error: "That product no longer exists" }, { status: 400 });
    }
  }

  if (typeof changes.code === "string" && changes.code !== existing.code) {
    const { data: clash } = await service
      .from("coupons")
      .select("id")
      .eq("code", changes.code)
      .neq("id", id)
      .maybeSingle();
    if (clash) {
      return NextResponse.json({ error: "A coupon with this code already exists" }, { status: 409 });
    }
  }

  const { data, error } = await service
    .from("coupons")
    .update(changes)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "A coupon with this code already exists" }, { status: 409 });
    }
    console.error("Coupon update error:", error.message);
    return NextResponse.json({ error: "Failed to update coupon" }, { status: 500 });
  }

  const oldValues: Record<string, unknown> = {};
  for (const key of Object.keys(changes)) oldValues[key] = existing[key];
  logAudit({
    userId: auth.user.id,
    action: "updated",
    entityType: "coupon",
    entityId: id,
    oldValues,
    newValues: changes,
  });

  return NextResponse.json(data);
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const auth = await authorize("super_admin");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  if (badId(id)) return NextResponse.json({ error: "Coupon not found" }, { status: 404 });

  const rl = await rateLimit(`coupon-delete-${auth.user.id}`, 20, 60000);
  if (!rl.success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const service = createServiceClient();
  const { data: existing, error: readError } = await service
    .from("coupons")
    .select("id, code, current_uses")
    .eq("id", id)
    .maybeSingle();
  if (readError) {
    console.error("Coupon read error:", readError.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
  if (!existing) return NextResponse.json({ error: "Coupon not found" }, { status: 404 });

  const usedMessage =
    "This coupon has already been used, so it can't be deleted (orders refer to it). Switch it to Inactive instead, and it will stop working.";

  if ((existing.current_uses ?? 0) > 0) {
    return NextResponse.json({ error: usedMessage }, { status: 409 });
  }

  // An order (paid, pending or free) records the coupon in its metadata.
  const { count, error: ordersError } = await service
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("metadata->>coupon_id", id);
  if (ordersError) {
    console.error("Coupon order check error:", ordersError.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
  if ((count ?? 0) > 0) {
    return NextResponse.json({ error: usedMessage }, { status: 409 });
  }

  // A shopping cart that applied the code but never checked out: drop the
  // code from the cart rather than block the delete.
  const { error: cartError } = await service
    .from("cart_items")
    .update({ coupon_id: null })
    .eq("coupon_id", id);
  if (cartError) {
    console.error("Coupon cart clear error:", cartError.message);
    return NextResponse.json({ error: "Failed to delete coupon" }, { status: 500 });
  }

  // Only while still unused: a checkout that claims a use in the meantime
  // makes this match nothing, and the coupon stays.
  const { data: deleted, error } = await service
    .from("coupons")
    .delete()
    .eq("id", id)
    .eq("current_uses", 0)
    .select("id");
  if (!error && (!deleted || deleted.length === 0)) {
    return NextResponse.json({ error: usedMessage }, { status: 409 });
  }
  if (error) {
    if (error.code === "23503") {
      return NextResponse.json({ error: usedMessage }, { status: 409 });
    }
    console.error("Coupon delete error:", error.message);
    return NextResponse.json({ error: "Failed to delete coupon" }, { status: 500 });
  }

  logAudit({
    userId: auth.user.id,
    action: "deleted",
    entityType: "coupon",
    entityId: id,
    oldValues: { code: existing.code },
  });

  return NextResponse.json({ success: true });
}
