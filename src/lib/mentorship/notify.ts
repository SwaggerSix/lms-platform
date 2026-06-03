import { createServiceClient } from "@/lib/supabase/service";
import { sendEmail } from "@/lib/email/sender";
import { mentorshipMatch, mentorshipNudge, mentorshipSessionScheduled } from "@/lib/email/templates";
import { sendPushToUsers } from "@/lib/push/dispatch";
import { buildGoogleCalendarUrl, buildOutlookCalendarUrl } from "@/lib/calendar-links";

// Fan-out notification when a mentor and mentee are paired: a row in the in-app
// inbox for each, plus an email. Best-effort — failures are logged but never
// thrown, so a notification problem cannot break the underlying assignment.
export async function notifyMentorshipMatch(params: {
  menteeId: string;
  mentorId: string;
  goals?: string | null;
}): Promise<void> {
  try {
    const service = createServiceClient();

    const { data: people } = await service
      .from("users")
      .select("id, email, first_name, last_name")
      .in("id", [params.menteeId, params.mentorId]);

    const list = (people ?? []) as Array<{ id: string; email: string; first_name: string | null; last_name: string | null }>;
    const mentee = list.find((u) => u.id === params.menteeId);
    const mentor = list.find((u) => u.id === params.mentorId);
    if (!mentee || !mentor) {
      console.error("notifyMentorshipMatch: missing user(s)", { menteeFound: !!mentee, mentorFound: !!mentor });
      return;
    }

    const fullName = (u: { email: string; first_name: string | null; last_name: string | null }) =>
      `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim() || u.email;
    const inAppLink = "/learn/mentorship";
    const emailLink = `${(process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "")}/learn/mentorship`;

    const { error: notifError } = await service.from("notifications").insert([
      {
        user_id: mentee.id,
        type: "mentorship",
        channel: "in_app",
        title: "You've been matched with a mentor",
        body: `${fullName(mentor)} will be your mentor.`,
        link: inAppLink,
        is_read: false,
      },
      {
        user_id: mentor.id,
        type: "mentorship",
        channel: "in_app",
        title: "New mentee assigned",
        body: `${fullName(mentee)} has been paired with you for mentorship.`,
        link: inAppLink,
        is_read: false,
      },
    ]);
    if (notifError) {
      console.error("notifyMentorshipMatch in-app insert error:", notifError.message);
    }

    const tplMentee = mentorshipMatch({
      recipientName: fullName(mentee),
      otherName: fullName(mentor),
      role: "mentee",
      goals: params.goals,
      link: emailLink,
    });
    const tplMentor = mentorshipMatch({
      recipientName: fullName(mentor),
      otherName: fullName(mentee),
      role: "mentor",
      goals: params.goals,
      link: emailLink,
    });

    await Promise.allSettled([
      sendEmail({ to: mentee.email, subject: tplMentee.subject, html: tplMentee.html, text: tplMentee.text }),
      sendEmail({ to: mentor.email, subject: tplMentor.subject, html: tplMentor.html, text: tplMentor.text }),
      sendPushToUsers({
        userIds: [mentee.id],
        title: tplMentee.subject,
        body: `${fullName(mentor)} will be your mentor.`,
        url: "/learn/mentorship",
      }),
      sendPushToUsers({
        userIds: [mentor.id],
        title: tplMentor.subject,
        body: `${fullName(mentee)} has been paired with you.`,
        url: "/learn/mentorship",
      }),
    ]);
  } catch (err) {
    console.error("notifyMentorshipMatch error:", err);
  }
}

// When a mentoring session is scheduled, notify both participants and give
// them one-click "add to calendar" links (plus an .ics). Best-effort.
export async function notifyMentorshipSessionScheduled(params: {
  sessionId: string;
  menteeId: string;
  mentorId: string;
  scheduledAt: string;
  durationMinutes: number;
  meetingUrl?: string | null;
}): Promise<void> {
  try {
    const service = createServiceClient();

    const { data: people } = await service
      .from("users")
      .select("id, email, first_name, last_name, timezone")
      .in("id", [params.menteeId, params.mentorId]);

    const list = (people ?? []) as Array<{
      id: string;
      email: string;
      first_name: string | null;
      last_name: string | null;
      timezone: string | null;
    }>;
    const mentee = list.find((u) => u.id === params.menteeId);
    const mentor = list.find((u) => u.id === params.mentorId);
    if (!mentee || !mentor) return;

    const fullName = (u: { email: string; first_name: string | null; last_name: string | null }) =>
      `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim() || u.email;

    const base = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
    const start = new Date(params.scheduledAt);
    const end = new Date(start.getTime() + params.durationMinutes * 60000);
    const icsUrl = `${base}/api/mentorship/sessions/${params.sessionId}/calendar`;

    const whenFor = (tz: string | null) =>
      start.toLocaleString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        ...(tz ? { timeZone: tz } : {}),
        timeZoneName: "short",
      });

    const calEvent = (otherName: string) => ({
      title: `Mentoring Session: ${otherName}`,
      start,
      end,
      description: params.meetingUrl ? `Join meeting: ${params.meetingUrl}` : "",
      location: params.meetingUrl ?? "",
    });

    await service.from("notifications").insert([
      {
        user_id: mentee.id,
        type: "mentorship",
        channel: "in_app",
        title: `Session scheduled with ${fullName(mentor)}`,
        body: `Your mentoring session is set for ${whenFor(mentee.timezone)}.`,
        link: "/learn/mentorship",
        is_read: false,
      },
      {
        user_id: mentor.id,
        type: "mentorship",
        channel: "in_app",
        title: `Session scheduled with ${fullName(mentee)}`,
        body: `Your mentoring session is set for ${whenFor(mentor.timezone)}.`,
        link: "/learn/mentorship",
        is_read: false,
      },
    ]);

    const tplMentee = mentorshipSessionScheduled({
      recipientName: fullName(mentee),
      otherName: fullName(mentor),
      whenText: whenFor(mentee.timezone),
      durationMinutes: params.durationMinutes,
      meetingUrl: params.meetingUrl,
      googleUrl: buildGoogleCalendarUrl(calEvent(fullName(mentor))),
      outlookUrl: buildOutlookCalendarUrl(calEvent(fullName(mentor))),
      icsUrl,
    });
    const tplMentor = mentorshipSessionScheduled({
      recipientName: fullName(mentor),
      otherName: fullName(mentee),
      whenText: whenFor(mentor.timezone),
      durationMinutes: params.durationMinutes,
      meetingUrl: params.meetingUrl,
      googleUrl: buildGoogleCalendarUrl(calEvent(fullName(mentee))),
      outlookUrl: buildOutlookCalendarUrl(calEvent(fullName(mentee))),
      icsUrl,
    });

    await Promise.allSettled([
      sendEmail({ to: mentee.email, subject: tplMentee.subject, html: tplMentee.html, text: tplMentee.text }),
      sendEmail({ to: mentor.email, subject: tplMentor.subject, html: tplMentor.html, text: tplMentor.text }),
      sendPushToUsers({
        userIds: [mentee.id, mentor.id],
        title: "Mentoring session scheduled",
        body: "A new mentoring session has been added.",
        url: "/learn/mentorship",
      }),
    ]);
  } catch (err) {
    console.error("notifyMentorshipSessionScheduled error:", err);
  }
}

// Send a cadence nudge to both sides of an active mentorship when they
// haven't met in a while. Same shape as the match notifier: in-app + email,
// best-effort, never throws.
export async function notifyMentorshipNudge(params: {
  menteeId: string;
  mentorId: string;
  daysSinceContact: number;
}): Promise<void> {
  try {
    const service = createServiceClient();

    const { data: people } = await service
      .from("users")
      .select("id, email, first_name, last_name")
      .in("id", [params.menteeId, params.mentorId]);

    const list = (people ?? []) as Array<{ id: string; email: string; first_name: string | null; last_name: string | null }>;
    const mentee = list.find((u) => u.id === params.menteeId);
    const mentor = list.find((u) => u.id === params.mentorId);
    if (!mentee || !mentor) return;

    const fullName = (u: { email: string; first_name: string | null; last_name: string | null }) =>
      `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim() || u.email;
    const inAppLink = "/learn/mentorship";
    const emailLink = `${(process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "")}/learn/mentorship`;

    const body = `It's been about ${params.daysSinceContact} days since your last session — time to reconnect.`;

    await service.from("notifications").insert([
      {
        user_id: mentee.id,
        type: "mentorship",
        channel: "in_app",
        title: `Reconnect with ${fullName(mentor)}`,
        body,
        link: inAppLink,
        is_read: false,
      },
      {
        user_id: mentor.id,
        type: "mentorship",
        channel: "in_app",
        title: `Reconnect with ${fullName(mentee)}`,
        body,
        link: inAppLink,
        is_read: false,
      },
    ]);

    const tplMentee = mentorshipNudge({ recipientName: fullName(mentee), otherName: fullName(mentor), daysSinceContact: params.daysSinceContact, link: emailLink });
    const tplMentor = mentorshipNudge({ recipientName: fullName(mentor), otherName: fullName(mentee), daysSinceContact: params.daysSinceContact, link: emailLink });
    await Promise.allSettled([
      sendEmail({ to: mentee.email, subject: tplMentee.subject, html: tplMentee.html, text: tplMentee.text }),
      sendEmail({ to: mentor.email, subject: tplMentor.subject, html: tplMentor.html, text: tplMentor.text }),
      sendPushToUsers({
        userIds: [mentee.id, mentor.id],
        title: "Time to reconnect",
        body,
        url: "/learn/mentorship",
      }),
    ]);
  } catch (err) {
    console.error("notifyMentorshipNudge error:", err);
  }
}
