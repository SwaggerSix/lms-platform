import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { readRequiredFor, recertificationTier, computeRecertExpiry } from "@/lib/courses/required-training";
import { sendEmail } from "@/lib/email/sender";
import { recertificationReminder } from "@/lib/email/templates";
import { fetchNotificationPrefs, userMaySend } from "@/lib/notifications/preferences";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return handler(request);
}

export async function POST(request: NextRequest) {
  return handler(request);
}

/**
 * Daily compliance sweep. Two responsibilities:
 *
 * 1. Renewal notifications. For each completed enrollment of a recurring
 *    required-training course (frequency_months set), emit one in-app
 *    notification per tier as the recurrence window approaches: 30-day,
 *    7-day, and overdue. Dedup is keyed on the notification's `link`
 *    field (`?recert=<courseId>&tier=<tier>`) so re-running the cron
 *    never produces duplicates. Each notification is sent to the
 *    learner AND their manager when one is on file.
 *
 * 2. Auto re-enrollment. Once a completion has aged past the
 *    recurrence window AND the learner has no open enrollment, create
 *    a fresh enrollment so the learner is back in the "needs to
 *    complete" state. Existing due-date / overdue notifications then
 *    take over.
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
    .select("id, slug, title, metadata")
    .neq("status", "archived");

  const now = new Date();
  let scanned = 0;
  let reEnrolled = 0;
  let notificationsSent = 0;
  const errors: string[] = [];

  type PendingNotif = {
    user_id: string;
    title: string;
    body: string;
    link: string;
    type: "reminder";
    channel: "in_app";
  };
  const pendingNotifications: PendingNotif[] = [];

  type PendingEmail = {
    email: string;
    learnerName: string;
    courseSlug: string;
    courseTitle: string;
    regulation: string | null;
    frequencyMonths: number;
    completedAt: string;
    tier: "30" | "7" | "expired";
  };
  const pendingEmails: PendingEmail[] = [];

  for (const course of courses ?? []) {
    const required = readRequiredFor((course as any).metadata);
    if (!required || !required.frequency_months) continue;
    scanned++;

    const courseId = (course as any).id as string;
    const courseTitle = (course as any).title as string;
    const courseSlug = (course as any).slug as string;
    const courseLink = `/learn/catalog/${courseSlug}?recert=${courseId}`;

    // Latest completion per user for this course.
    const { data: completions } = await service
      .from("enrollments")
      .select("user_id, completed_at, status")
      .eq("course_id", courseId)
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

    // Bucket users by tier: 30-day, 7-day, expired.
    const tier30: string[] = [];
    const tier7: string[] = [];
    const expired: string[] = [];
    for (const [userId, completedAt] of latestByUser.entries()) {
      const tier = recertificationTier(completedAt, required.frequency_months, now);
      if (tier === "expired") expired.push(userId);
      else if (tier === "7") tier7.push(userId);
      else if (tier === "30") tier30.push(userId);
    }

    // For notifications, build the candidate (user, tier) pairs then filter
    // out any whose link already exists in the notifications table.
    const candidatesByTier: Array<{
      users: string[];
      tier: "30" | "7" | "expired";
      title: string;
      bodyFn: (regulation: string | null) => string;
    }> = [
      {
        users: tier30,
        tier: "30",
        title: `Recertification due in 30 days: ${courseTitle}`,
        bodyFn: (reg) => `Your completion of "${courseTitle}" expires within 30 days. Retake before then to stay${reg ? ` ${reg}` : ""} compliant.`,
      },
      {
        users: tier7,
        tier: "7",
        title: `Recertification due in 1 week: ${courseTitle}`,
        bodyFn: (reg) => `Your completion of "${courseTitle}" expires in 7 days or less. Please retake the course to stay${reg ? ` ${reg}` : ""} compliant.`,
      },
      {
        users: expired,
        tier: "expired",
        title: `Recertification overdue: ${courseTitle}`,
        bodyFn: (reg) => `Your completion of "${courseTitle}" has expired. You have been re-enrolled to restore${reg ? ` ${reg}` : ""} compliance.`,
      },
    ];

    // Resolve managers + email + name for all candidate users in one go.
    const allCandidateIds = Array.from(
      new Set([...tier30, ...tier7, ...expired])
    );
    const managerByUser = new Map<string, string | null>();
    const userInfoById = new Map<
      string,
      {
        email: string | null;
        firstName: string | null;
        lastName: string | null;
        completedAt: string;
        emailRecertOptOut: boolean;
        inAppRecertOptOut: boolean;
      }
    >();
    if (allCandidateIds.length > 0) {
      const { data: userRows } = await service
        .from("users")
        .select("id, manager_id, email, first_name, last_name")
        .in("id", allCandidateIds);
      const prefsByUser = await fetchNotificationPrefs(service, allCandidateIds);
      for (const u of userRows ?? []) {
        const completedAt = latestByUser.get((u as any).id) ?? "";
        managerByUser.set((u as any).id, (u as any).manager_id ?? null);
        const prefs = prefsByUser.get((u as any).id);
        userInfoById.set((u as any).id, {
          email: (u as any).email ?? null,
          firstName: (u as any).first_name ?? null,
          lastName: (u as any).last_name ?? null,
          completedAt,
          emailRecertOptOut: !userMaySend(prefs, "recertification", "email"),
          inAppRecertOptOut: !userMaySend(prefs, "recertification", "inApp"),
        });
      }
    }

    // Email sends are batched after we know which (user, tier) pairs are
    // genuinely new — see pendingEmails accumulation below.

    for (const group of candidatesByTier) {
      if (group.users.length === 0) continue;
      const link = `${courseLink}&tier=${group.tier}`;

      // Find users who already received this tier's notification (dedup).
      const { data: existing } = await service
        .from("notifications")
        .select("user_id")
        .eq("link", link)
        .in("user_id", group.users);
      const alreadySent = new Set((existing ?? []).map((n: any) => n.user_id));

      for (const userId of group.users) {
        if (alreadySent.has(userId)) continue;
        const info = userInfoById.get(userId);

        if (!info?.inAppRecertOptOut) {
          const body = group.bodyFn(required.regulation ?? null);
          pendingNotifications.push({
            user_id: userId,
            title: group.title,
            body,
            link,
            type: "reminder",
            channel: "in_app",
          });
        }

        // Queue an email for this learner unless they've opted out. Email
        // dedup leans on the in-app link, so we record a "would have emailed"
        // marker via the in-app notification row even when opted out — but
        // skipping the in-app insert above breaks that dedup. To keep things
        // simple and correct, only queue an email when in-app is also being
        // inserted.
        if (info?.email && info.completedAt && !info.emailRecertOptOut && !info.inAppRecertOptOut) {
          const name = `${info.firstName ?? ""} ${info.lastName ?? ""}`.trim() || "there";
          pendingEmails.push({
            email: info.email,
            learnerName: name,
            courseSlug,
            courseTitle,
            regulation: required.regulation ?? null,
            frequencyMonths: required.frequency_months,
            completedAt: info.completedAt,
            tier: group.tier,
          });
        }

        // Cc the manager so they see it too. Dedup against link, but use a
        // manager-specific link suffix so a manager with multiple reports
        // gets one notification per (report, course, tier).
        const managerId = managerByUser.get(userId);
        if (managerId) {
          const managerLink = `${link}&for=${userId}`;
          pendingNotifications.push({
            user_id: managerId,
            title: `Team recertification ${group.tier === "expired" ? "overdue" : "due soon"}: ${courseTitle}`,
            body: `A direct report's compliance for "${courseTitle}" ${group.tier === "expired" ? "has expired" : `expires within ${group.tier} days`}.`,
            link: managerLink,
            type: "reminder",
            channel: "in_app",
          });
        }
      }
    }

    // Auto re-enroll for the "expired" group when there's no open enrollment.
    if (expired.length === 0) continue;

    const { data: openEnrollments } = await service
      .from("enrollments")
      .select("user_id")
      .eq("course_id", courseId)
      .neq("status", "completed")
      .in("user_id", expired);

    const openUsers = new Set((openEnrollments ?? []).map((e: any) => e.user_id));
    const toEnroll = expired.filter((uid) => !openUsers.has(uid));
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
      course_id: courseId,
      status: "enrolled" as const,
      assigned_by: null,
      due_date: dueDate,
    }));

    const { error } = await service.from("enrollments").insert(inserts);
    if (error) {
      errors.push(`Course ${courseId}: ${error.message}`);
      continue;
    }
    reEnrolled += inserts.length;
  }

  // Filter out manager-cc notifications whose link already exists, since the
  // first dedup pass only checked the learner's link. We have to query again
  // for the manager-specific link.
  if (pendingNotifications.length > 0) {
    const managerLinks = pendingNotifications
      .filter((n) => n.link.includes("&for="))
      .map((n) => n.link);
    const existingManagerLinks = new Set<string>();
    if (managerLinks.length > 0) {
      const { data: dups } = await service
        .from("notifications")
        .select("link, user_id")
        .in("link", managerLinks);
      for (const d of dups ?? []) {
        existingManagerLinks.add(`${(d as any).user_id}|${(d as any).link}`);
      }
    }
    const finalNotifs = pendingNotifications.filter(
      (n) => !n.link.includes("&for=") || !existingManagerLinks.has(`${n.user_id}|${n.link}`)
    );

    if (finalNotifs.length > 0) {
      const { error: notifErr } = await service.from("notifications").insert(finalNotifs);
      if (notifErr) {
        errors.push(`Notifications: ${notifErr.message}`);
      } else {
        notificationsSent = finalNotifs.length;
      }
    }
  }

  // Send transactional emails for queued recertification reminders. Email
  // dedup is implicit via the in-app notification dedup above — pendingEmails
  // only contains the *new* tier transitions for each learner.
  let emailsSent = 0;
  if (pendingEmails.length > 0) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
    const sends = pendingEmails.map(async (item) => {
      const expires = computeRecertExpiry(item.completedAt, item.frequencyMonths);
      const expiryDate = expires.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      const daysUntilExpiry = Math.ceil(
        (expires.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
      );

      const courseUrl = `${appUrl}/learn/catalog/${item.courseSlug}`;
      const template = recertificationReminder({
        learnerName: item.learnerName,
        courseName: item.courseTitle,
        regulation: item.regulation,
        daysUntilExpiry,
        expiryDate,
        courseUrl,
      });
      const res = await sendEmail({
        to: item.email,
        subject: template.subject,
        html: template.html,
        text: template.text,
      });
      return res.success;
    });
    const results = await Promise.allSettled(sends);
    for (const r of results) {
      if (r.status === "fulfilled" && r.value === true) emailsSent++;
    }
  }

  return NextResponse.json({
    message: "Compliance recurrence sweep complete",
    courses_scanned: scanned,
    learners_reenrolled: reEnrolled,
    notifications_sent: notificationsSent,
    emails_sent: emailsSent,
    errors,
  });
}
