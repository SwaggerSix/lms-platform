import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/auth/authorize";
import { createServiceClient } from "@/lib/supabase/service";
import { sendEmail } from "@/lib/email/sender";
import { dueDateReminder, customTemplate } from "@/lib/email/templates";
import { storedTemplateOverride } from "@/lib/notifications/email-overrides";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "";
const MAX_TARGETS = 100;
// Don't re-nudge the same learner about the same course within this window,
// even across bulk sends by different admins.
const DEDUPE_WINDOW_MS = 24 * 60 * 60 * 1000;

interface NudgeTarget {
  user_id: string;
  course_id: string;
}

/**
 * POST /api/reports/at-risk/nudge — send a re-engagement reminder (in-app
 * notification + email) to learners flagged by the at-risk report.
 * Body: { targets: [{ user_id, course_id }] }
 */
export async function POST(request: NextRequest) {
  const auth = await authorize("admin", "manager");
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let targets: NudgeTarget[];
  try {
    const body = await request.json();
    targets = body?.targets;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (
    !Array.isArray(targets) ||
    targets.length === 0 ||
    targets.some(
      (t) => typeof t?.user_id !== "string" || typeof t?.course_id !== "string"
    )
  ) {
    return NextResponse.json(
      { error: "targets must be a non-empty array of { user_id, course_id }" },
      { status: 400 }
    );
  }
  if (targets.length > MAX_TARGETS) {
    return NextResponse.json(
      { error: `At most ${MAX_TARGETS} targets per request` },
      { status: 400 }
    );
  }

  const service = createServiceClient();
  const dedupeCutoff = new Date(Date.now() - DEDUPE_WINDOW_MS).toISOString();
  const results: { user_id: string; course_id: string; outcome: string }[] = [];

  for (const target of targets) {
    try {
      const { data: enrollment } = await service
        .from("enrollments")
        .select(
          "id, status, progress, due_date, user:users!enrollments_user_id_fkey(id, first_name, last_name, email, organization_id), course:courses(id, title)"
        )
        .eq("user_id", target.user_id)
        .eq("course_id", target.course_id)
        .maybeSingle();

      const user = (enrollment as any)?.user;
      const course = (enrollment as any)?.course;
      if (!enrollment || !user || !course) {
        results.push({ ...target, outcome: "not_found" });
        continue;
      }
      if (enrollment.status === "completed") {
        results.push({ ...target, outcome: "already_completed" });
        continue;
      }

      const courseLink = `/learn/courses/${course.id}`;

      const { count: recentCount } = await service
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", target.user_id)
        .eq("type", "reminder")
        .eq("link", courseLink)
        .gte("created_at", dedupeCutoff);
      if (recentCount && recentCount > 0) {
        results.push({ ...target, outcome: "recently_reminded" });
        continue;
      }

      const learnerName = `${user.first_name ?? ""}`.trim() || "there";
      const progress = enrollment.progress ?? 0;
      const dueDate = enrollment.due_date
        ? new Date(enrollment.due_date)
        : null;
      const overdue = dueDate !== null && dueDate.getTime() < Date.now();

      const notificationBody = overdue
        ? `${course.title} was due on ${dueDate!.toISOString().split("T")[0]}. You're ${progress}% through — pick it back up to get compliant.`
        : dueDate
          ? `${course.title} is due on ${dueDate.toISOString().split("T")[0]}. You're ${progress}% through — keep going!`
          : `You're ${progress}% through ${course.title}. Pick up where you left off!`;

      const { error: notifyError } = await service.from("notifications").insert({
        user_id: target.user_id,
        type: "reminder",
        title: `Reminder: ${course.title}`,
        body: notificationBody,
        link: courseLink,
        channel: "in_app",
        is_read: false,
      });
      if (notifyError) throw notifyError;

      if (user.email) {
        const courseUrl = `${APP_URL}${courseLink}`;
        let template;
        if (dueDate) {
          const daysRemaining = Math.max(
            0,
            Math.ceil((dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
          );
          const params = {
            learnerName,
            courseName: course.title,
            dueDate: dueDate.toISOString().split("T")[0],
            daysRemaining,
            courseUrl,
          };
          const fallback = dueDateReminder(params);
          template =
            (await storedTemplateOverride(
              "due_date_reminder",
              params,
              user.organization_id ?? null,
              fallback.subject
            )) ?? fallback;
        } else {
          template = customTemplate({
            subject: `Reminder: continue ${course.title}`,
            bodyText: `Hi ${learnerName},\n\n${notificationBody}`,
            ctaText: "Continue Course",
            ctaUrl: courseUrl,
          });
        }

        const emailResult = await sendEmail({
          to: user.email,
          subject: template.subject,
          html: template.html,
          text: template.text,
        });
        results.push({
          ...target,
          outcome: emailResult.success ? "sent" : "sent_in_app_only",
        });
      } else {
        results.push({ ...target, outcome: "sent_in_app_only" });
      }
    } catch (err) {
      console.error(
        `At-risk nudge failed for user ${target.user_id} / course ${target.course_id}:`,
        err
      );
      results.push({ ...target, outcome: "error" });
    }
  }

  const sent = results.filter((r) => r.outcome.startsWith("sent")).length;
  return NextResponse.json({
    sent,
    skipped: results.length - sent,
    results,
  });
}
