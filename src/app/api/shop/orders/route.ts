import { authorize } from "@/lib/auth/authorize";
import { isManagerOrAbove } from "@/lib/auth/roles";
import { createServiceClient } from "@/lib/supabase/service";
import { NextRequest, NextResponse } from "next/server";
import { jsonNoStore } from "@/lib/api/no-store";

export async function GET(request: NextRequest) {
  const auth = await authorize("admin", "manager", "instructor", "learner");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const service = createServiceClient();
  const { searchParams } = new URL(request.url);

  const status = searchParams.get("status");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const offset = (page - 1) * limit;

  const canManage = isManagerOrAbove(auth.user.role);

  let query = service
    .from("orders")
    .select("*, order_items(*, product:products(*, course:courses(id, title, thumbnail_url)))", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (!canManage) {
    query = query.eq("user_id", auth.user.id);
  }

  if (status) query = query.eq("status", status);

  const { data, count, error } = await query;

  if (error) {
    console.error("Orders API error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return jsonNoStore({
    orders: data,
    total: count,
    page,
    totalPages: Math.ceil((count || 0) / limit),
  });
}
