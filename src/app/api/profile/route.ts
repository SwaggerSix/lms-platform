import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { NextRequest, NextResponse } from "next/server";
import { EXTERNAL_SOURCE, PORTAL_OWNED_USER_FIELDS, type PortalOwnedUserField } from "@/lib/integrations/partner-portal/sync";
import { postProfileWriteback } from "@/lib/integrations/partner-portal/writeback";

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
    .select("id, auth_id, first_name, last_name, email, role, job_title, organization_id, manager_id, avatar_url, bio, timezone, hire_date, status, preferences, created_at, updated_at")
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
    .select("id, external_source, external_id")
    .eq("auth_id", authUser.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const body = await request.json();

  // Only allow self-editable fields
  const allowedFields = ["first_name", "last_name", "preferences", "avatar_url", "bio", "timezone"];

  const sanitized = Object.fromEntries(
    Object.entries(body).filter(([key]) => allowedFields.includes(key))
  );

  if (Object.keys(sanitized).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const { data, error } = await service
    .from("users")
    .update(sanitized)
    .eq("id", profile.id)
    .select("id, first_name, last_name, email, preferences, avatar_url, bio, timezone")
    .single();

  if (error) {
    console.error("Profile API error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  // Two-way sync: for subcontractors synced from the partner portal (system of
  // record), the edit is allowed locally and the changed portal-owned fields are
  // pushed back to the portal, which then re-syncs the canonical value here and
  // to CoachHub. Fire-and-forget.
  if (profile.external_source === EXTERNAL_SOURCE && profile.external_id) {
    const writeback: Partial<Record<PortalOwnedUserField, unknown>> = {};
    for (const f of PORTAL_OWNED_USER_FIELDS) {
      if (f in sanitized) writeback[f] = sanitized[f];
    }
    await postProfileWriteback(profile.external_id, writeback);
  }

  return NextResponse.json(data);
}
