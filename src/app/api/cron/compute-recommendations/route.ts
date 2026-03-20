import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  computeUserPreferences,
  computeCourseSimilarity,
} from "@/lib/ai/recommendations";

/**
 * GET /api/cron/compute-recommendations
 *
 * Periodically recompute:
 * 1. User learning preferences for recently active users
 * 2. Course similarity matrix for all published courses
 * 3. Clean up old learning events (>90 days)
 *
 * Triggered by Vercel cron or external scheduler.
 * Secured by CRON_SECRET header.
 */
export async function GET(request: NextRequest) {
  // Verify cron secret
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const service = createServiceClient();
  const results = {
    usersProcessed: 0,
    coursesProcessed: 0,
    eventsDeleted: 0,
    errors: [] as string[],
  };

  // 1. Recompute user preferences for active users (active in last 30 days)
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: activeUsers } = await service
      .from("learning_events")
      .select("user_id")
      .gte("created_at", thirtyDaysAgo.toISOString())
      .limit(1000);

    // Deduplicate user IDs
    const uniqueUserIds = [...new Set((activeUsers ?? []).map((e) => e.user_id))];

    // Also include users with recent enrollments
    const { data: recentEnrollments } = await service
      .from("enrollments")
      .select("user_id")
      .gte("enrolled_at", thirtyDaysAgo.toISOString())
      .limit(1000);

    const enrollmentUserIds = (recentEnrollments ?? []).map((e: any) => e.user_id);
    const allUserIds = [...new Set([...uniqueUserIds, ...enrollmentUserIds])];

    for (const userId of allUserIds) {
      try {
        await computeUserPreferences(userId);
        results.usersProcessed++;
      } catch (err) {
        results.errors.push(`User ${userId}: ${String(err)}`);
      }
    }
  } catch (err) {
    results.errors.push(`User preferences phase: ${String(err)}`);
  }

  // 2. Recompute course similarity for all published courses
  try {
    const { data: publishedCourses } = await service
      .from("courses")
      .select("id")
      .eq("status", "published")
      .limit(500);

    for (const course of publishedCourses ?? []) {
      try {
        await computeCourseSimilarity(course.id);
        results.coursesProcessed++;
      } catch (err) {
        results.errors.push(`Course ${course.id}: ${String(err)}`);
      }
    }
  } catch (err) {
    results.errors.push(`Course similarity phase: ${String(err)}`);
  }

  // 3. Clean up old learning events (>90 days)
  try {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const { error: deleteError } = await service
      .from("learning_events")
      .delete()
      .lt("created_at", ninetyDaysAgo.toISOString());

    if (!deleteError) {
      results.eventsDeleted = -1; // deletion succeeded, exact count not available
    }
  } catch (err) {
    results.errors.push(`Cleanup phase: ${String(err)}`);
  }

  console.log("Recommendation cron completed:", results);

  return NextResponse.json({
    success: true,
    ...results,
  });
}
