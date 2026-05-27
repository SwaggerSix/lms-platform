import { authorize } from "@/lib/auth/authorize";
import { createServiceClient } from "@/lib/supabase/service";
import { NextRequest, NextResponse } from "next/server";
import { validateBody, createMentorReviewSchema } from "@/lib/validations";
import { rateLimit } from "@/lib/rate-limit";
import { jsonNoStore } from "@/lib/api/no-store";

export async function POST(request: NextRequest) {
  const auth = await authorize();
  if (!auth.authorized) return jsonNoStore({ error: auth.error }, { status: auth.status });

  const rl = await rateLimit(`review-create-${auth.user.id}`, 5, 60000);
  if (!rl.success) return jsonNoStore({ error: "Too many requests" }, { status: 429 });

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonNoStore({ error: "Invalid JSON body" }, { status: 400 });
  }

  const validation = validateBody(createMentorReviewSchema, body);
  if (!validation.success) {
    return jsonNoStore({ error: validation.error }, { status: 400 });
  }

  const service = createServiceClient();

  // Verify request exists and user was the mentee
  const { data: mentorshipRequest } = await service
    .from("mentorship_requests")
    .select("id, mentee_id, mentor_id, status")
    .eq("id", validation.data.request_id)
    .single();

  if (!mentorshipRequest) {
    return jsonNoStore({ error: "Mentorship request not found" }, { status: 404 });
  }

  if (mentorshipRequest.mentee_id !== auth.user.id) {
    return jsonNoStore({ error: "Only mentees can review mentors" }, { status: 403 });
  }

  if (!["completed", "active"].includes(mentorshipRequest.status)) {
    return jsonNoStore(
      { error: "Can only review active or completed mentorships" },
      { status: 400 }
    );
  }

  // Check for existing review
  const { data: existingReview } = await service
    .from("mentor_reviews")
    .select("id")
    .eq("request_id", validation.data.request_id)
    .eq("reviewer_id", auth.user.id)
    .limit(1);

  if (existingReview && existingReview.length > 0) {
    return jsonNoStore({ error: "You have already reviewed this mentorship" }, { status: 409 });
  }

  const { data, error } = await service
    .from("mentor_reviews")
    .insert({
      ...validation.data,
      reviewer_id: auth.user.id,
    })
    .select()
    .single();

  if (error) {
    console.error("Review create error:", error.message);
    return jsonNoStore({ error: "Internal server error" }, { status: 500 });
  }

  // Update mentor's rating
  if (mentorshipRequest.mentor_id) {
    const { data: allReviews } = await service
      .from("mentor_reviews")
      .select("rating")
      .in(
        "request_id",
        (
          await service
            .from("mentorship_requests")
            .select("id")
            .eq("mentor_id", mentorshipRequest.mentor_id)
        ).data?.map((r: any) => r.id) ?? []
      );

    if (allReviews && allReviews.length > 0) {
      const avgRating =
        allReviews.reduce((sum: number, r) => sum + r.rating, 0) /
        allReviews.length;

      await service
        .from("mentor_profiles")
        .update({
          rating: Math.round(avgRating * 100) / 100,
          total_reviews: allReviews.length,
        })
        .eq("user_id", mentorshipRequest.mentor_id);
    }
  }

  return jsonNoStore(data, { status: 201 });
}
