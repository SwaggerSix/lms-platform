import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { authorize } from "@/lib/auth/authorize";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const service = createServiceClient();
  const { data: profile } = await service.from("users").select("id, role").eq("auth_id", user.id).single();
  if (!profile) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("user_id");
  const type = searchParams.get("type") || "summary";

  if (userId && userId !== profile.id && !["admin", "manager"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (type === "leaderboard") {
    const { data, error } = await service.rpc("get_user_points").limit(20);

    // Fallback: query points_ledger directly
    if (error) {
      const { data: points } = await service
        .from("points_ledger")
        .select("user_id, points")
        .order("created_at", { ascending: false });

      // Aggregate points by user
      const userPoints = new Map<string, number>();
      points?.forEach((p) => {
        userPoints.set(p.user_id, (userPoints.get(p.user_id) || 0) + p.points);
      });

      const sorted = Array.from(userPoints.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20);

      return NextResponse.json(sorted.map(([user_id, total], i) => ({ rank: i + 1, user_id, total })));
    }

    return NextResponse.json(data);
  }

  if (userId && type === "summary") {
    const [points, badges, recentActivity] = await Promise.all([
      service.from("points_ledger").select("points").eq("user_id", userId),
      service.from("user_badges").select("*, badge:badges(*)").eq("user_id", userId),
      service
        .from("points_ledger")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

    const totalPoints = points.data?.reduce((sum, p) => sum + p.points, 0) || 0;

    return NextResponse.json({
      total_points: totalPoints,
      level: Math.floor(totalPoints / 200) + 1,
      badges: badges.data || [],
      recent_activity: recentActivity.data || [],
    });
  }

  // Get all badges
  const { data, error } = await service.from("badges").select("*").order("category");
  if (error) {
    console.error("Gamification API error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const auth = await authorize("admin");
  const service = createServiceClient();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabase = await createClient();
  const body = await request.json();

  const { name, description, icon, criteria_type, criteria_count, points } = body;

  if (!name) {
    return NextResponse.json({ error: "Badge name is required" }, { status: 400 });
  }

  const { data, error } = await service
    .from("badges")
    .insert({
      name,
      description: description || "",
      category: criteria_type || "achievement",
      criteria: {
        emoji: icon || "🏆",
        color: "bg-indigo-100",
        type: criteria_type || "achievement",
        count: criteria_count || 1,
        points: points || 0,
        display_text: `${criteria_type || "achievement"}: ${criteria_count || 1}`,
        description: description || "",
      },
    })
    .select()
    .single();

  if (error) {
    console.error("Gamification API error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const auth = await authorize("admin");
  const service = createServiceClient();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabase = await createClient();
  const body = await request.json();

  const { id, ...updates } = body;

  if (!id) {
    return NextResponse.json({ error: "Badge id is required" }, { status: 400 });
  }

  // Build the update payload
  const payload: Record<string, any> = {};
  if (updates.name) payload.name = updates.name;
  if (updates.description !== undefined) payload.description = updates.description;
  if (updates.category) payload.category = updates.category;
  if (updates.criteria) payload.criteria = updates.criteria;

  const { data, error } = await service
    .from("badges")
    .update(payload)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Gamification API error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
  return NextResponse.json(data);
}
