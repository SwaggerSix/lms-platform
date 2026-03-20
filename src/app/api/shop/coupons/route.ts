import { authorize } from "@/lib/auth/authorize";
import { createServiceClient } from "@/lib/supabase/service";
import { NextRequest, NextResponse } from "next/server";
import { validateBody, createCouponSchema } from "@/lib/validations";
import { rateLimit } from "@/lib/rate-limit";

export async function GET() {
  const auth = await authorize("admin", "manager");
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

  return NextResponse.json({ coupons: data });
}

export async function POST(request: NextRequest) {
  const auth = await authorize("admin", "manager");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const rl = await rateLimit(`coupon-create-${auth.user.id}`, 20, 60000);
  if (!rl.success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const body = await request.json();
  const validation = validateBody(createCouponSchema, body);
  if (!validation.success) return NextResponse.json({ error: validation.error }, { status: 400 });

  const service = createServiceClient();

  const insertData = {
    ...validation.data,
    code: validation.data.code.toUpperCase().trim(),
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
