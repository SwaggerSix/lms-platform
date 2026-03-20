import { authorize } from "@/lib/auth/authorize";
import { createServiceClient } from "@/lib/supabase/service";
import { NextRequest, NextResponse } from "next/server";
import { validateBody, addToCartSchema } from "@/lib/validations";
import { rateLimit } from "@/lib/rate-limit";

export async function GET() {
  const auth = await authorize("admin", "manager", "instructor", "learner");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const service = createServiceClient();
  const { data, error } = await service
    .from("cart_items")
    .select("*, product:products(*, course:courses(id, title, thumbnail_url, short_description))")
    .eq("user_id", auth.user.id)
    .order("added_at", { ascending: false });

  if (error) {
    console.error("Cart GET error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ items: data });
}

export async function POST(request: NextRequest) {
  const auth = await authorize("admin", "manager", "instructor", "learner");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const rl = await rateLimit(`cart-add-${auth.user.id}`, 30, 60000);
  if (!rl.success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const body = await request.json();
  const validation = validateBody(addToCartSchema, body);
  if (!validation.success) return NextResponse.json({ error: validation.error }, { status: 400 });

  const service = createServiceClient();

  // Check product exists and is active
  const { data: product } = await service
    .from("products")
    .select("id, course_id, status")
    .eq("id", validation.data.product_id)
    .single();

  if (!product || product.status !== "active") {
    return NextResponse.json({ error: "Product not available" }, { status: 404 });
  }

  // Check if user is already enrolled
  const { data: enrollment } = await service
    .from("enrollments")
    .select("id")
    .eq("user_id", auth.user.id)
    .eq("course_id", product.course_id)
    .single();

  if (enrollment) {
    return NextResponse.json({ error: "You are already enrolled in this course" }, { status: 409 });
  }

  const { data, error } = await service
    .from("cart_items")
    .upsert(
      { user_id: auth.user.id, product_id: validation.data.product_id },
      { onConflict: "user_id,product_id" }
    )
    .select()
    .single();

  if (error) {
    console.error("Cart add error:", error.message);
    return NextResponse.json({ error: "Failed to add to cart" }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const auth = await authorize("admin", "manager", "instructor", "learner");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { searchParams } = new URL(request.url);
  const productId = searchParams.get("product_id");

  if (!productId) {
    return NextResponse.json({ error: "product_id is required" }, { status: 400 });
  }

  const service = createServiceClient();
  const { error } = await service
    .from("cart_items")
    .delete()
    .eq("user_id", auth.user.id)
    .eq("product_id", productId);

  if (error) {
    console.error("Cart delete error:", error.message);
    return NextResponse.json({ error: "Failed to remove from cart" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
