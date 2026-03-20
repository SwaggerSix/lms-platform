import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/auth/authorize";
import { createServiceClient } from "@/lib/supabase/service";
import { rateLimit } from "@/lib/rate-limit";

/**
 * GET /api/xapi/activities/state
 * Retrieve an activity state document.
 */
export async function GET(request: NextRequest) {
  const auth = await authorize("admin", "manager", "instructor", "learner");
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { searchParams } = new URL(request.url);
  const activityId = searchParams.get("activityId");
  const stateId = searchParams.get("stateId");

  if (!activityId) {
    return NextResponse.json({ error: "activityId parameter required" }, { status: 400 });
  }

  const service = createServiceClient();

  // If stateId is provided, return a single document
  if (stateId) {
    const { data, error } = await service
      .from("xapi_activity_state")
      .select("*")
      .eq("activity_id", activityId)
      .eq("agent_id", auth.user.id)
      .eq("state_id", stateId)
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

  // No stateId - return list of state IDs for the activity
  const { data, error } = await service
    .from("xapi_activity_state")
    .select("state_id, updated_at")
    .eq("activity_id", activityId)
    .eq("agent_id", auth.user.id);

  if (error) {
    console.error("Activity state query error:", error.message);
    return NextResponse.json({ error: "Failed to query activity state" }, { status: 500 });
  }

  const stateIds = (data || []).map((d) => d.state_id);
  return NextResponse.json(stateIds, {
    headers: { "X-Experience-API-Version": "1.0.3" },
  });
}

/**
 * PUT /api/xapi/activities/state
 * Store or update an activity state document.
 */
export async function PUT(request: NextRequest) {
  const auth = await authorize("admin", "manager", "instructor", "learner");
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const rl = await rateLimit(`xapi-state-put-${auth.user.id}`, 30, 60000);
  if (!rl.success) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const { searchParams } = new URL(request.url);
  const activityId = searchParams.get("activityId");
  const stateId = searchParams.get("stateId");
  const registration = searchParams.get("registration");

  if (!activityId || !stateId) {
    return NextResponse.json(
      { error: "activityId and stateId parameters required" },
      { status: 400 }
    );
  }

  const document = await request.json();
  const service = createServiceClient();

  const { error } = await service
    .from("xapi_activity_state")
    .upsert(
      {
        activity_id: activityId,
        agent_id: auth.user.id,
        state_id: stateId,
        registration: registration || null,
        document,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "activity_id,agent_id,state_id" }
    );

  if (error) {
    console.error("Failed to store activity state:", error.message);
    return NextResponse.json({ error: "Failed to store activity state" }, { status: 500 });
  }

  return NextResponse.json(null, {
    status: 204,
    headers: { "X-Experience-API-Version": "1.0.3" },
  });
}

/**
 * DELETE /api/xapi/activities/state
 * Delete an activity state document.
 */
export async function DELETE(request: NextRequest) {
  const auth = await authorize("admin", "manager", "instructor", "learner");
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { searchParams } = new URL(request.url);
  const activityId = searchParams.get("activityId");
  const stateId = searchParams.get("stateId");

  if (!activityId) {
    return NextResponse.json({ error: "activityId parameter required" }, { status: 400 });
  }

  const service = createServiceClient();

  let query = service
    .from("xapi_activity_state")
    .delete()
    .eq("activity_id", activityId)
    .eq("agent_id", auth.user.id);

  if (stateId) {
    query = query.eq("state_id", stateId);
  }

  const { error } = await query;

  if (error) {
    console.error("Failed to delete activity state:", error.message);
    return NextResponse.json({ error: "Failed to delete activity state" }, { status: 500 });
  }

  return NextResponse.json(null, {
    status: 204,
    headers: { "X-Experience-API-Version": "1.0.3" },
  });
}
