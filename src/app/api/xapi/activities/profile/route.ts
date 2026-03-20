import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/auth/authorize";
import { createServiceClient } from "@/lib/supabase/service";
import { rateLimit } from "@/lib/rate-limit";

/**
 * GET /api/xapi/activities/profile
 * Retrieve an activity profile document.
 */
export async function GET(request: NextRequest) {
  const auth = await authorize("admin", "manager", "instructor", "learner");
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { searchParams } = new URL(request.url);
  const activityId = searchParams.get("activityId");
  const profileId = searchParams.get("profileId");

  if (!activityId) {
    return NextResponse.json({ error: "activityId parameter required" }, { status: 400 });
  }

  const service = createServiceClient();

  if (profileId) {
    const { data, error } = await service
      .from("xapi_activity_profile")
      .select("*")
      .eq("activity_id", activityId)
      .eq("profile_id", profileId)
      .single();

    if (error || !data) {
      return NextResponse.json(null, {
        status: 404,
        headers: { "X-Experience-API-Version": "1.0.3" },
      });
    }

    return NextResponse.json(data.document, {
      headers: { "X-Experience-API-Version": "1.0.3" },
    });
  }

  // Return list of profile IDs
  const { data, error } = await service
    .from("xapi_activity_profile")
    .select("profile_id, updated_at")
    .eq("activity_id", activityId);

  if (error) {
    console.error("Activity profile query error:", error.message);
    return NextResponse.json({ error: "Failed to query activity profiles" }, { status: 500 });
  }

  const profileIds = (data || []).map((d) => d.profile_id);
  return NextResponse.json(profileIds, {
    headers: { "X-Experience-API-Version": "1.0.3" },
  });
}

/**
 * PUT /api/xapi/activities/profile
 * Store or update an activity profile document.
 */
export async function PUT(request: NextRequest) {
  const auth = await authorize("admin", "manager", "instructor");
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const rl = await rateLimit(`xapi-profile-put-${auth.user.id}`, 20, 60000);
  if (!rl.success) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const { searchParams } = new URL(request.url);
  const activityId = searchParams.get("activityId");
  const profileId = searchParams.get("profileId");

  if (!activityId || !profileId) {
    return NextResponse.json(
      { error: "activityId and profileId parameters required" },
      { status: 400 }
    );
  }

  const document = await request.json();
  const service = createServiceClient();

  const { error } = await service
    .from("xapi_activity_profile")
    .upsert(
      {
        activity_id: activityId,
        profile_id: profileId,
        document,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "activity_id,profile_id" }
    );

  if (error) {
    console.error("Failed to store activity profile:", error.message);
    return NextResponse.json({ error: "Failed to store activity profile" }, { status: 500 });
  }

  return NextResponse.json(null, {
    status: 204,
    headers: { "X-Experience-API-Version": "1.0.3" },
  });
}

/**
 * DELETE /api/xapi/activities/profile
 * Delete an activity profile document.
 */
export async function DELETE(request: NextRequest) {
  const auth = await authorize("admin");
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { searchParams } = new URL(request.url);
  const activityId = searchParams.get("activityId");
  const profileId = searchParams.get("profileId");

  if (!activityId || !profileId) {
    return NextResponse.json(
      { error: "activityId and profileId parameters required" },
      { status: 400 }
    );
  }

  const service = createServiceClient();

  const { error } = await service
    .from("xapi_activity_profile")
    .delete()
    .eq("activity_id", activityId)
    .eq("profile_id", profileId);

  if (error) {
    console.error("Failed to delete activity profile:", error.message);
    return NextResponse.json({ error: "Failed to delete activity profile" }, { status: 500 });
  }

  return NextResponse.json(null, {
    status: 204,
    headers: { "X-Experience-API-Version": "1.0.3" },
  });
}
