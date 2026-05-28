import { authorize } from "@/lib/auth/authorize";
import { createServiceClient } from "@/lib/supabase/service";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorize();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const service = createServiceClient();

  const { data, error } = await service
    .from("mentor_profiles")
    .select(
      "*, user:users!mentor_profiles_user_id_fkey(id, first_name, last_name, email, job_title)"
    )
    .eq("id", id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Mentor profile not found" }, { status: 404 });
  }

  // Also fetch recent reviews
  const { data: reviews } = await service
    .from("mentor_reviews")
    .select(
      "*, reviewer:users!mentor_reviews_reviewer_id_fkey(first_name, last_name)"
    )
    .eq("request_id", id)
    .order("created_at", { ascending: false })
    .limit(10);

  // Fetch reviews for this mentor's requests
  const { data: mentorRequests } = await service
    .from("mentorship_requests")
    .select("id")
    .eq("mentor_id", data.user_id)
    .in("status", ["completed", "active"]);

  const requestIds = (mentorRequests ?? []).map((r: any) => r.id);

  let mentorReviews: any[] = [];
  if (requestIds.length > 0) {
    const { data: revs } = await service
      .from("mentor_reviews")
      .select(
        "*, reviewer:users!mentor_reviews_reviewer_id_fkey(first_name, last_name)"
      )
      .in("request_id", requestIds)
      .order("created_at", { ascending: false })
      .limit(10);
    mentorReviews = revs ?? [];
  }

  return NextResponse.json({ ...data, reviews: mentorReviews });
}

// Admin/manager management of a mentor profile (e.g. activate/deactivate).
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorize("admin", "manager");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (typeof body.is_active === "boolean") updates.is_active = body.is_active;
  if (typeof body.availability === "string") updates.availability = body.availability;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }
  updates.updated_at = new Date().toISOString();

  const service = createServiceClient();
  const { data, error } = await service
    .from("mentor_profiles")
    .update(updates)
    .eq("id", id)
    .select("id, is_active, availability")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Mentor profile not found" }, { status: 404 });
  }

  return NextResponse.json(data);
}
