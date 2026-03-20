import { authorize } from "@/lib/auth/authorize";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { validateBody, createNuggetSchema } from "@/lib/validations";
import { rateLimit } from "@/lib/rate-limit";
import { getTenantScope } from "@/lib/tenants/tenant-queries";

export async function GET(request: NextRequest) {
  const auth = await authorize();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const tenantScope = await getTenantScope(auth.user.id, auth.user.role, request);

  const service = createServiceClient();
  const { searchParams } = new URL(request.url);

  const limit = Math.min(parseInt(searchParams.get("limit") || "10"), 50);
  const page = parseInt(searchParams.get("page") || "1");
  const offset = (page - 1) * limit;
  const contentType = searchParams.get("content_type");
  const difficulty = searchParams.get("difficulty");
  const courseId = searchParams.get("course_id");
  const tag = searchParams.get("tag");

  let query = service
    .from("microlearning_nuggets")
    .select("*", { count: "exact" })
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (contentType) query = query.eq("content_type", contentType);
  if (difficulty) query = query.eq("difficulty", difficulty);
  if (courseId) query = query.eq("course_id", courseId);
  if (tag) query = query.contains("tags", [tag]);

  const { data, count, error } = await query;

  if (error) {
    console.error("Microlearning nuggets GET error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  // Fetch user progress for these nuggets
  const nuggetIds = (data ?? []).map((n) => n.id);
  let progressMap: Record<string, string> = {};
  if (nuggetIds.length > 0) {
    const { data: progress } = await service
      .from("microlearning_progress")
      .select("nugget_id, status")
      .eq("user_id", auth.user.id)
      .in("nugget_id", nuggetIds);

    for (const p of progress ?? []) {
      progressMap[p.nugget_id] = p.status;
    }
  }

  const nuggets = (data ?? []).map((n) => ({
    ...n,
    user_status: progressMap[n.id] || null,
  }));

  return NextResponse.json({
    nuggets,
    total: count,
    page,
    totalPages: Math.ceil((count || 0) / limit),
  });
}

export async function POST(request: NextRequest) {
  const auth = await authorize("admin", "instructor");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const rl = await rateLimit(`nugget-create-${auth.user.id}`, 20, 60000);
  if (!rl.success) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const validation = validateBody(createNuggetSchema, body);
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const service = createServiceClient();
  const { data, error } = await service
    .from("microlearning_nuggets")
    .insert({ ...validation.data, created_by: auth.user.id })
    .select()
    .single();

  if (error) {
    console.error("Microlearning nuggets POST error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
