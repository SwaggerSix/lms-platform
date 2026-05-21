import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { readRequiredFor } from "@/lib/courses/required-training";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return handler(request);
}

export async function POST(request: NextRequest) {
  return handler(request);
}

/**
 * Sweeps every required-training course that has a `frequency_months`
 * compliance recurrence and re-enrolls learners whose previous completion has
 * aged past the recurrence window. Idempotent: a learner already holding an
 * open (non-completed) enrollment for the course is skipped, so we never
 * stack duplicate active enrollments.
 */
async function handler(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const service = createServiceClient();
  const { data: courses } = await service
    .from("courses")
    .select("id, metadata")
    .neq("status", "archived");

  const now = new Date();
  let scanned = 0;
  let reEnrolled = 0;
  const errors: string[] = [];

  for (const course of courses ?? []) {
    const required = readRequiredFor((course as any).metadata);
    if (!required || !required.frequency_months) continue;
    scanned++;

    // Latest completion per user for this course.
    const { data: completions } = await service
      .from("enrollments")
      .select("user_id, completed_at, status")
      .eq("course_id", (course as any).id)
      .eq("status", "completed")
      .not("completed_at", "is", null);

    if (!completions || completions.length === 0) continue;

    const latestByUser = new Map<string, string>();
    for (const e of completions as any[]) {
      const current = latestByUser.get(e.user_id);
      if (!current || new Date(e.completed_at) > new Date(current)) {
        latestByUser.set(e.user_id, e.completed_at);
      }
    }

    // Filter to users whose last completion is older than frequency_months.
    const dueUserIds: string[] = [];
    for (const [userId, completedAt] of latestByUser.entries()) {
      const expiresAt = new Date(completedAt);
      expiresAt.setMonth(expiresAt.getMonth() + required.frequency_months);
      if (expiresAt < now) dueUserIds.push(userId);
    }

    if (dueUserIds.length === 0) continue;

    // Skip anyone who already has an open (non-completed) enrollment.
    const { data: openEnrollments } = await service
      .from("enrollments")
      .select("user_id")
      .eq("course_id", (course as any).id)
      .neq("status", "completed")
      .in("user_id", dueUserIds);

    const openUsers = new Set((openEnrollments ?? []).map((e: any) => e.user_id));
    const toEnroll = dueUserIds.filter((uid) => !openUsers.has(uid));
    if (toEnroll.length === 0) continue;

    const dueDate = required.due_days
      ? (() => {
          const d = new Date(now);
          d.setDate(d.getDate() + required.due_days!);
          return d.toISOString().split("T")[0];
        })()
      : null;

    const inserts = toEnroll.map((userId) => ({
      user_id: userId,
      course_id: (course as any).id,
      status: "enrolled" as const,
      assigned_by: null,
      due_date: dueDate,
    }));

    const { error } = await service.from("enrollments").insert(inserts);
    if (error) {
      errors.push(`Course ${(course as any).id}: ${error.message}`);
      continue;
    }
    reEnrolled += inserts.length;
  }

  return NextResponse.json({
    message: "Compliance recurrence sweep complete",
    courses_scanned: scanned,
    learners_reenrolled: reEnrolled,
    errors,
  });
}
