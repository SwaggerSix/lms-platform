import { authorize } from "@/lib/auth/authorize";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { validateBody, createMarketplaceProviderSchema } from "@/lib/validations";
import { rateLimit } from "@/lib/rate-limit";

export async function GET(request: NextRequest) {
  const auth = await authorize("admin");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const service = createServiceClient();

  const { data, error } = await service
    .from("marketplace_providers")
    .select("*, course_count:marketplace_courses(count)")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Marketplace providers GET error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  const providers = (data ?? []).map((p) => ({
    ...p,
    course_count: (p.course_count as any)?.[0]?.count || 0,
  }));

  return NextResponse.json({ providers });
}

export async function POST(request: NextRequest) {
  const auth = await authorize("admin");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const rl = await rateLimit(`mp-provider-${auth.user.id}`, 10, 60000);
  if (!rl.success) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const validation = validateBody(createMarketplaceProviderSchema, body);
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const service = createServiceClient();
  const { data, error } = await service
    .from("marketplace_providers")
    .insert({ ...validation.data, created_by: auth.user.id })
    .select()
    .single();

  if (error) {
    console.error("Marketplace providers POST error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
