import { authorize } from "@/lib/auth/authorize";
import { createServiceClient } from "@/lib/supabase/service";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const auth = await authorize("admin", "manager", "instructor", "learner");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const service = createServiceClient();
  const { searchParams } = new URL(request.url);

  const status = searchParams.get("status");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const offset = (page - 1) * limit;

  const isAdmin = auth.user.role === "admin" || auth.user.role === "manager";

  let query = service
    .from("orders")
    .select("*, order_items(*, product:products(*, course:courses(id, title, thumbnail_url)))", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (!isAdmin) {
    query = query.eq("user_id", auth.user.id);
  }

  if (status) query = query.eq("status", status);

  const { data, count, error } = await query;

  if (error) {
    console.error("Orders API error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({
    orders: data,
    total: count,
    page,
    totalPages: Math.ceil((count || 0) / limit),
  });
}
