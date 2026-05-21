import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/profile — return the authenticated user's full profile.
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

  const { data: profile, error } = await service
    .from("users")
    .select("id, auth_id, first_name, last_name, email, role, job_title, organization_id, manager_id, avatar_url, hire_date, status, preferences, created_at, updated_at")
    .eq("auth_id", authUser.id)
    .single();

  if (error || !profile) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json(profile);
}

/**
 * PATCH /api/profile — update the authenticated user's own profile.
 * Uses the service client to bypass RLS, but scoped to the caller's own row.
 */
export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const service = createServiceClient();

  // Look up internal user id
  const { data: profile } = await service
    .from("users")
    .select("id")
    .eq("auth_id", authUser.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const body = await request.json();

  // Only allow self-editable fields
  const allowedFields = ["first_name", "last_name", "preferences", "avatar_url"];
  const sanitized = Object.fromEntries(
    Object.entries(body).filter(([key]) => allowedFields.includes(key))
  );

  if (Object.keys(sanitized).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  // preferences is a JSON blob with many top-level keys (notifications,
  // ui_prefs, dashboard_widgets, etc.). A naive UPDATE replaces it
  // wholesale, which lets a small toggle (e.g. ui_prefs.hide_platform_audit)
  // wipe everything else. Deep-merge two levels: top keys merge by spread,
  // and each top-key's object value also merges so nested updates like
  // { ui_prefs: { hide_platform_audit: true } } compose with existing
  // ui_prefs.* siblings.
  if (sanitized.preferences && typeof sanitized.preferences === "object") {
    const { data: existing } = await service
      .from("users")
      .select("preferences")
      .eq("id", profile.id)
      .single();
    const current = ((existing?.preferences ?? {}) as Record<string, unknown>) || {};
    const incoming = sanitized.preferences as Record<string, unknown>;
    const merged: Record<string, unknown> = { ...current };
    for (const [k, v] of Object.entries(incoming)) {
      if (
        v &&
        typeof v === "object" &&
        !Array.isArray(v) &&
        current[k] &&
        typeof current[k] === "object" &&
        !Array.isArray(current[k])
      ) {
        merged[k] = { ...(current[k] as Record<string, unknown>), ...(v as Record<string, unknown>) };
      } else {
        merged[k] = v;
      }
    }
    sanitized.preferences = merged;
  }

  const { data, error } = await service
    .from("users")
    .update(sanitized)
    .eq("id", profile.id)
    .select("id, first_name, last_name, email, preferences, avatar_url")
    .single();

  if (error) {
    console.error("Profile API error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json(data);
}
