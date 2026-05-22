import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { NextRequest, NextResponse } from "next/server";
import { deepMergePreferences, diffPreferences } from "@/lib/preferences/merge";
import { logAudit } from "@/lib/audit";

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
  // wholesale, so we deep-merge via the shared helper in
  // src/lib/preferences/merge.ts.
  let oldPreferences: Record<string, unknown> | null = null;
  let incomingPreferences: Record<string, unknown> | null = null;
  if (sanitized.preferences && typeof sanitized.preferences === "object") {
    const { data: existing } = await service
      .from("users")
      .select("preferences")
      .eq("id", profile.id)
      .single();
    const current = (existing?.preferences ?? {}) as Record<string, unknown>;
    oldPreferences = current;
    incomingPreferences = sanitized.preferences as Record<string, unknown>;
    sanitized.preferences = deepMergePreferences(current, sanitized.preferences as Record<string, unknown>);
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

  // Audit the preference change — when admins (or compliance) need to
  // reconstruct what a user toggled, the old/new shape is in audit_logs.
  // We record only the *changed* leaves (not the full blob) to keep the
  // entry compact. Fire-and-forget; failure to audit never fails the PATCH.
  if (oldPreferences && incomingPreferences) {
    const diff = diffPreferences(oldPreferences, data.preferences as Record<string, unknown>);
    if (Object.keys(diff.changed).length > 0 || Object.keys(diff.removed).length > 0) {
      logAudit({
        userId: profile.id,
        action: "profile.preferences.update",
        entityType: "user_preferences",
        entityId: profile.id,
        oldValues: diff.removed,
        newValues: diff.changed,
      }).catch(() => {});
    }
  }

  return NextResponse.json(data, {
    // Mutation result; never cache. Especially important because the
    // response body includes the merged preferences blob — a stale
    // version served to a polling caller could roll back a user's
    // change.
    headers: { "Cache-Control": "private, no-store" },
  });
}

