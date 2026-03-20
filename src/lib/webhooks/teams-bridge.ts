import {
  sendTeamsNotificationIfConfigured,
  courseEnrollmentCard,
  courseCompletionCard,
  certificateEarnedCard,
  newUserRegisteredCard,
  type AdaptiveCard,
} from "@/lib/integrations/teams/notifications";
import type { WebhookEvent } from "./dispatcher";

/**
 * Maps a webhook event + payload to an Adaptive Card and sends it
 * to the configured Teams channel. Returns silently if Teams is not
 * configured or if the event type has no card template.
 */
export async function dispatchTeamsNotification(
  event: WebhookEvent,
  payload: Record<string, any>
): Promise<void> {
  const card = buildCard(event, payload);
  if (!card) return;

  await sendTeamsNotificationIfConfigured(card);
}

function buildCard(
  event: WebhookEvent,
  payload: Record<string, any>
): AdaptiveCard | null {
  switch (event) {
    case "enrollment.created":
      return courseEnrollmentCard({
        userName: payload.user_name || payload.userName || "Unknown",
        courseName: payload.course_name || payload.courseName || "Unknown",
        enrolledAt: payload.enrolled_at || new Date().toISOString(),
        courseUrl: payload.course_url || payload.courseUrl,
      });

    case "enrollment.completed":
      return courseCompletionCard({
        userName: payload.user_name || payload.userName || "Unknown",
        courseName: payload.course_name || payload.courseName || "Unknown",
        completedAt: payload.completed_at || new Date().toISOString(),
        score: payload.score,
        courseUrl: payload.course_url || payload.courseUrl,
      });

    case "certificate.issued":
      return certificateEarnedCard({
        userName: payload.user_name || payload.userName || "Unknown",
        certificateName:
          payload.certificate_name || payload.certificateName || "Unknown",
        issuedAt: payload.issued_at || new Date().toISOString(),
        expiresAt: payload.expires_at || payload.expiresAt,
        certificateUrl: payload.certificate_url || payload.certificateUrl,
      });

    case "user.created":
      return newUserRegisteredCard({
        userName: payload.user_name || payload.userName || "Unknown",
        email: payload.email || "N/A",
        registeredAt: payload.created_at || new Date().toISOString(),
        role: payload.role,
        profileUrl: payload.profile_url || payload.profileUrl,
      });

    default:
      // No card template for this event type
      return null;
  }
}
