export type AnalyticsEvent =
  | "page_view"
  | "course_enrolled"
  | "course_started"
  | "lesson_completed"
  | "course_completed"
  | "assessment_started"
  | "assessment_submitted"
  | "badge_earned"
  | "certificate_downloaded"
  | "discussion_posted"
  | "message_sent"
  | "ilt_registered"
  | "document_viewed"
  | "search_performed";

export async function trackEvent(event: AnalyticsEvent, data?: Record<string, any>) {
  try {
    await fetch("/api/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event_type: event, metadata: data }),
    });
  } catch {
    // Never let analytics break the user experience
  }
}
