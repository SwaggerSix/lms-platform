import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/auth/authorize";
import { createServiceClient } from "@/lib/supabase/service";

// Sales reporting for a storefront: revenue, order counts by status, seats
// sold, top courses, and a daily revenue series over the requested window.
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await authorize("super_admin");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await context.params;

  const days = Math.min(365, Math.max(7, parseInt(new URL(request.url).searchParams.get("days") || "90")));
  const since = new Date(Date.now() - days * 86400 * 1000).toISOString();

  const service = createServiceClient();

  const { data: orders } = await service
    .from("orders")
    .select("id, status, total, refunded_amount, created_at")
    .eq("storefront_id", id)
    .gte("created_at", since);

  const statusCounts: Record<string, number> = {};
  let grossRevenue = 0;
  let refunded = 0;
  let completedOrders = 0;
  const dailyRevenue: Record<string, number> = {};

  for (const o of orders || []) {
    statusCounts[o.status] = (statusCounts[o.status] || 0) + 1;
    refunded += Number(o.refunded_amount || 0);
    if (o.status === "completed" || o.status === "partially_refunded") {
      grossRevenue += Number(o.total);
      completedOrders++;
      const day = o.created_at.slice(0, 10);
      dailyRevenue[day] = (dailyRevenue[day] || 0) + Number(o.total);
    }
  }

  // Top courses by seats and revenue (completed/partially-refunded orders only).
  const completedIds = (orders || [])
    .filter((o) => o.status === "completed" || o.status === "partially_refunded")
    .map((o) => o.id);

  const topCourses: { name: string; seats: number; revenue: number }[] = [];
  if (completedIds.length) {
    const { data: items } = await service
      .from("order_items")
      .select("product_name, price, quantity, product:products(name)")
      .in("order_id", completedIds);
    const byCourse = new Map<string, { seats: number; revenue: number }>();
    for (const it of items || []) {
      const name = it.product_name || (it.product as { name?: string } | null)?.name || "Course";
      const cur = byCourse.get(name) || { seats: 0, revenue: 0 };
      cur.seats += it.quantity;
      cur.revenue += Number(it.price) * it.quantity;
      byCourse.set(name, cur);
    }
    for (const [name, v] of byCourse) topCourses.push({ name, ...v });
    topCourses.sort((a, b) => b.revenue - a.revenue);
  }

  return NextResponse.json({
    windowDays: days,
    grossRevenue: Math.round(grossRevenue * 100) / 100,
    netRevenue: Math.round((grossRevenue - refunded) * 100) / 100,
    refunded: Math.round(refunded * 100) / 100,
    completedOrders,
    totalOrders: (orders || []).length,
    statusCounts,
    seatsSold: topCourses.reduce((s, c) => s + c.seats, 0),
    topCourses: topCourses.slice(0, 10),
    dailyRevenue: Object.entries(dailyRevenue)
      .map(([date, revenue]) => ({ date, revenue: Math.round(revenue * 100) / 100 }))
      .sort((a, b) => a.date.localeCompare(b.date)),
  });
}
