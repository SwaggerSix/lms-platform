import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/profile/skills — return the authenticated user's skills list.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const service = createServiceClient();

  const { data: profile } = await service
    .from("users")
    .select("id")
    .eq("auth_id", authUser.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { data: skills, error } = await service
    .from("user_skills")
    .select("proficiency_level, source, assessed_at, skill:skills(id, name, category)")
    .eq("user_id", profile.id);

  if (error) {
    console.error("Profile skills GET error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json(skills ?? []);
}

/**
 * POST /api/profile/skills — upsert a self-assessed skill for the current user.
 * Uses the service client to bypass RLS.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const service = createServiceClient();

  const { data: profile } = await service
    .from("users")
    .select("id")
    .eq("auth_id", authUser.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const body = await request.json();
  const { skill_name, proficiency_level, notes } = body;

  if (!skill_name || !proficiency_level) {
    return NextResponse.json({ error: "skill_name and proficiency_level are required" }, { status: 400 });
  }

  // Look up the skill by name
  const { data: skillRow, error: skillErr } = await service
    .from("skills")
    .select("id")
    .eq("name", skill_name)
    .single();

  if (skillErr || !skillRow) {
    return NextResponse.json({ error: "Skill not found" }, { status: 404 });
  }

  const { data, error } = await service
    .from("user_skills")
    .upsert(
      {
        user_id: profile.id,
        skill_id: skillRow.id,
        proficiency_level,
        source: "Self Reported",
        notes: notes || null,
        assessed_at: new Date().toISOString(),
      },
      { onConflict: "user_id,skill_id" }
    )
    .select()
    .single();

  if (error) {
    console.error("Skills self-assessment error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
