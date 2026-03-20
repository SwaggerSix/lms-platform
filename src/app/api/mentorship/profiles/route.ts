import { authorize } from "@/lib/auth/authorize";
import { createServiceClient } from "@/lib/supabase/service";
import { NextRequest, NextResponse } from "next/server";
import { validateBody, createMentorProfileSchema } from "@/lib/validations";
import { rateLimit } from "@/lib/rate-limit";
import { getTenantScope } from "@/lib/tenants/tenant-queries";

export async function GET(request: NextRequest) {
  const auth = await authorize();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const tenantScope = await getTenantScope(auth.user.id, auth.user.role, request);

  const service = createServiceClient();
  const { searchParams } = new URL(request.url);

  const search = searchParams.get("search");
  const availability = searchParams.get("availability");
  const expertise = searchParams.get("expertise");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "12");
  const offset = (page - 1) * limit;

  let query = service
    .from("mentor_profiles")
    .select(
      "*, user:users!mentor_profiles_user_id_fkey(id, first_name, last_name, email, job_title)",
      { count: "exact" }
    )
    .eq("is_active", true)
    .order("rating", { ascending: false, nullsFirst: false })
    .range(offset, offset + limit - 1);

  if (tenantScope) {
    query = query.in("user_id", tenantScope.userIds);
  }

  if (availability) {
    query = query.eq("availability", availability);
  }

  if (expertise) {
    query = query.contains("expertise_areas", [expertise]);
  }

  const { data, count, error } = await query;

  if (error) {
    console.error("Mentor profiles API error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  // Client-side search filter on user name
  let filtered = data ?? [];
  if (search) {
    const s = search.toLowerCase();
    filtered = filtered.filter((m: any) => {
      const user = m.user as any;
      const name = `${user?.first_name ?? ""} ${user?.last_name ?? ""}`.toLowerCase();
      const bio = (m.bio ?? "").toLowerCase();
      return name.includes(s) || bio.includes(s);
    });
  }

  return NextResponse.json({
    mentors: filtered,
    total: search ? filtered.length : count,
    page,
    totalPages: Math.ceil((search ? filtered.length : count || 0) / limit),
  });
}

export async function POST(request: NextRequest) {
  const auth = await authorize();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const rl = await rateLimit(`mentor-profile-${auth.user.id}`, 5, 60000);
  if (!rl.success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const validation = validateBody(createMentorProfileSchema, body);
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const service = createServiceClient();

  // Upsert: create or update
  const { data, error } = await service
    .from("mentor_profiles")
    .upsert(
      { user_id: auth.user.id, ...validation.data, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    )
    .select("*, user:users!mentor_profiles_user_id_fkey(id, first_name, last_name, email)")
    .single();

  if (error) {
    console.error("Mentor profile create error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
