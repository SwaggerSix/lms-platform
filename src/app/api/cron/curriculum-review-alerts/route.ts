import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { dispatchWebhook } from "@/lib/webhooks/dispatcher";

export const dynamic = "force-dynamic";

type AlertKey = "month_1" | "week_2";

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;
const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000;
const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;

export async function GET(request: NextRequest) {
  return handler(request);
}

export async function POST(request: NextRequest) {
  return handler(request);
}

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
  const now = Date.now();

  const { data: courses, error: coursesErr } = await service
    .from("courses")
    .select("id, title, slug, metadata, status")
    .neq("status", "archived");

  if (coursesErr) {
    console.error("[curriculum-review-alerts] courses query error", coursesErr);
    return NextResponse.json({ error: "Failed to load courses" }, { status: 500 });
  }

  const { data: admins, error: adminsErr } = await service
    .from("users")
    .select("id")
    .in("role", ["admin", "super_admin"])
    .eq("status", "active");

  if (adminsErr) {
    console.error("[curriculum-review-alerts] admins query error", adminsErr);
    return NextResponse.json({ error: "Failed to load admins" }, { status: 500 });
  }

  const adminIds = (admins ?? []).map((a) => a.id);
  if (adminIds.length === 0) {
    return NextResponse.json({ message: "No active admins to notify", checked: courses?.length ?? 0 });
  }

  const notifications: Array<{
    user_id: string;
    type: string;
    title: string;
    body: string;
    link: string;
    channel: string;
  }> = [];
  const courseUpdates: Array<{ id: string; metadata: Record<string, unknown> }> = [];

  for (const course of courses ?? []) {
    const metadata = (course.metadata ?? {}) as Record<string, unknown>;
    const lastReviewStr = metadata.last_curriculum_review as string | undefined;
    if (!lastReviewStr) continue;

    const lastReview = new Date(lastReviewStr).getTime();
    if (!Number.isFinite(lastReview)) continue;

    const oneYearAfter = lastReview + ONE_YEAR_MS;
    const msUntilOneYear = oneYearAfter - now;

    // Already past 1 year — skip (admins will see overdue via dashboard, not as repeat alerts)
    if (msUntilOneYear <= 0) continue;

    const alertsSent = (metadata.review_alerts_sent ?? {}) as Record<string, boolean>;
    const newAlertsSent: Record<string, boolean> = { ...alertsSent };
    let trigger: AlertKey | null = null;

    if (msUntilOneYear <= TWO_WEEKS_MS && !alertsSent.week_2) {
      trigger = "week_2";
    } else if (msUntilOneYear <= ONE_MONTH_MS && !alertsSent.month_1) {
      trigger = "month_1";
    }

    if (!trigger) continue;

    const daysLeft = Math.max(0, Math.ceil(msUntilOneYear / (24 * 60 * 60 * 1000)));
    const label = trigger === "week_2" ? "2 weeks" : "1 month";

    for (const adminId of adminIds) {
      notifications.push({
        user_id: adminId,
        type: "reminder",
        title: `Curriculum review due: ${course.title}`,
        body: `This course's last curriculum review was on ${lastReviewStr}. It will be 1 year old in ${daysLeft} day${daysLeft === 1 ? "" : "s"} (${label} reminder).`,
        link: `/admin/courses/${course.slug}`,
        channel: "in_app",
      });
    }

    newAlertsSent[trigger] = true;
    courseUpdates.push({
      id: course.id,
      metadata: { ...metadata, review_alerts_sent: newAlertsSent },
    });

    // Notify external integrations (fire-and-forget).
    dispatchWebhook("curriculum_review.due_soon", {
      course_id: course.id,
      course_slug: course.slug,
      course_title: course.title,
      last_curriculum_review: lastReviewStr,
      days_until_due: daysLeft,
      alert: trigger,
    }).catch(() => {});
  }

  if (notifications.length > 0) {
    const { error: notifErr } = await service.from("notifications").insert(notifications);
    if (notifErr) {
      console.error("[curriculum-review-alerts] notification insert error", notifErr);
      return NextResponse.json({ error: "Failed to insert notifications" }, { status: 500 });
    }
  }

  for (const update of courseUpdates) {
    const { error: updateErr } = await service
      .from("courses")
      .update({ metadata: update.metadata })
      .eq("id", update.id);
    if (updateErr) {
      console.error("[curriculum-review-alerts] course metadata update error", updateErr);
    }
  }

  return NextResponse.json({
    message: "Curriculum review alerts processed",
    checked: courses?.length ?? 0,
    courses_triggered: courseUpdates.length,
    notifications_sent: notifications.length,
  });
}
