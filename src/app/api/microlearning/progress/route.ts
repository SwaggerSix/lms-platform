import { authorize } from "@/lib/auth/authorize";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { validateBody, createMicroProgressSchema } from "@/lib/validations";
import { rateLimit } from "@/lib/rate-limit";

export async function GET(request: NextRequest) {
  const auth = await authorize();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const service = createServiceClient();
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  let query = service
    .from("microlearning_progress")
    .select("*, nugget:microlearning_nuggets(*)")
    .eq("user_id", auth.user.id)
    .order("created_at", { ascending: false });

  if (status) query = query.eq("status", status);

  const { data, error } = await query;

  if (error) {
    console.error("Microlearning progress GET error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  const stats = {
    total_viewed: (data ?? []).filter((p) => p.status === "viewed").length,
    total_completed: (data ?? []).filter((p) => p.status === "completed").length,
    total_bookmarked: (data ?? []).filter((p) => p.status === "bookmarked").length,
    average_score:
      (data ?? [])
        .filter((p) => p.score != null)
        .reduce((sum, p) => sum + Number(p.score), 0) /
        Math.max((data ?? []).filter((p) => p.score != null).length, 1),
  };

  return NextResponse.json({ progress: data, stats });
}

export async function POST(request: NextRequest) {
  const auth = await authorize();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const rl = await rateLimit(`micro-progress-${auth.user.id}`, 60, 60000);
  if (!rl.success) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const validation = validateBody(createMicroProgressSchema, body);
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const service = createServiceClient();

  // Verify nugget exists
  const { data: nugget } = await service
    .from("microlearning_nuggets")
    .select("id")
    .eq("id", validation.data.nugget_id)
    .single();

  if (!nugget) {
    return NextResponse.json({ error: "Nugget not found" }, { status: 404 });
  }

  const { data, error } = await service
    .from("microlearning_progress")
    .upsert(
      {
        user_id: auth.user.id,
        nugget_id: validation.data.nugget_id,
        status: validation.data.status,
        score: validation.data.score ?? null,
        completed_at: validation.data.status === "completed" ? new Date().toISOString() : null,
      },
      { onConflict: "user_id,nugget_id" }
    )
    .select()
    .single();

  if (error) {
    console.error("Microlearning progress POST error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
