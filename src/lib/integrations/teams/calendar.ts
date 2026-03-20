import { createServiceClient } from "@/lib/supabase/service";

// ─── Azure AD Configuration ────────────────────────────────────

const AZURE_CLIENT_ID = process.env.AZURE_CLIENT_ID || "";
const AZURE_TENANT_ID = process.env.AZURE_TENANT_ID || "";
const AZURE_CLIENT_SECRET = process.env.AZURE_CLIENT_SECRET || "";

const TOKEN_URL = `https://login.microsoftonline.com/${AZURE_TENANT_ID}/oauth2/v2.0/token`;
const GRAPH_BASE_URL = "https://graph.microsoft.com/v1.0";

// ─── Types ──────────────────────────────────────────────────────

interface ILTSession {
  id: string;
  title: string;
  description?: string;
  session_date: string;
  start_time: string;
  end_time: string;
  location?: string;
  instructor_id?: string;
  instructor_email?: string;
  max_attendees?: number;
  course_id?: string;
  course_name?: string;
  meeting_url?: string;
}

interface GraphCalendarEvent {
  id: string;
  subject: string;
  webLink: string;
  onlineMeeting?: {
    joinUrl: string;
  };
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

// ─── Token Cache ────────────────────────────────────────────────

let cachedToken: { token: string; expiresAt: number } | null = null;

/**
 * Acquire an app-only access token using client credentials flow.
 */
async function getAccessToken(): Promise<string> {
  // Return cached token if still valid (with 5 min buffer)
  if (cachedToken && cachedToken.expiresAt > Date.now() + 300_000) {
    return cachedToken.token;
  }

  const body = new URLSearchParams({
    client_id: AZURE_CLIENT_ID,
    client_secret: AZURE_CLIENT_SECRET,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(
      `Azure AD token request failed (${response.status}): ${errorText.slice(0, 300)}`
    );
  }

  const data: TokenResponse = await response.json();

  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  return data.access_token;
}

// ─── Check if Calendar Sync is Enabled ──────────────────────────

export async function isCalendarSyncEnabled(): Promise<boolean> {
  try {
    const service = createServiceClient();
    const { data } = await service
      .from("platform_settings")
      .select("value")
      .eq("key", "teams_calendar_sync")
      .single();

    if (!data?.value) return false;

    const config = data.value as { enabled?: boolean };
    return config.enabled === true;
  } catch {
    return false;
  }
}

// ─── Create Calendar Event ──────────────────────────────────────

/**
 * Create a Teams/Outlook calendar event for an ILT session via
 * Microsoft Graph API using app-only (client credentials) auth.
 *
 * The organizer_email parameter determines which user's calendar
 * receives the event (requires Calendars.ReadWrite app permission).
 */
export async function createTeamsCalendarEvent(
  session: ILTSession,
  organizerEmail?: string
): Promise<{ success: boolean; eventId?: string; joinUrl?: string; error?: string }> {
  try {
    // Check if calendar sync is enabled
    const enabled = await isCalendarSyncEnabled();
    if (!enabled) {
      return { success: false, error: "Teams calendar sync is not enabled" };
    }

    const token = await getAccessToken();

    // Build the event payload
    const startDateTime = combineDateAndTime(session.session_date, session.start_time);
    const endDateTime = combineDateAndTime(session.session_date, session.end_time);

    const eventPayload: Record<string, any> = {
      subject: session.title || "ILT Session",
      body: {
        contentType: "HTML",
        content: buildEventBody(session),
      },
      start: {
        dateTime: startDateTime,
        timeZone: "UTC",
      },
      end: {
        dateTime: endDateTime,
        timeZone: "UTC",
      },
      isOnlineMeeting: true,
      onlineMeetingProvider: "teamsForBusiness",
    };

    if (session.location) {
      eventPayload.location = {
        displayName: session.location,
      };
    }

    // Determine the calendar endpoint
    // If we have an organizer email, create on their calendar; otherwise use default
    const calendarEndpoint = organizerEmail
      ? `${GRAPH_BASE_URL}/users/${organizerEmail}/events`
      : `${GRAPH_BASE_URL}/users/${session.instructor_email || organizerEmail}/events`;

    if (!organizerEmail && !session.instructor_email) {
      return {
        success: false,
        error: "No organizer or instructor email provided for calendar event",
      };
    }

    const response = await fetch(calendarEndpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(eventPayload),
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      return {
        success: false,
        error: `Graph API error (${response.status}): ${errorBody.slice(0, 300)}`,
      };
    }

    const event: GraphCalendarEvent = await response.json();

    // Store the event ID in the ilt_sessions table
    await storeGraphEventId(session.id, event.id);

    return {
      success: true,
      eventId: event.id,
      joinUrl: event.onlineMeeting?.joinUrl,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Failed to create Teams calendar event",
    };
  }
}

// ─── Update Calendar Event ──────────────────────────────────────

/**
 * Update an existing Teams calendar event when an ILT session is modified.
 */
export async function updateTeamsCalendarEvent(
  session: ILTSession,
  graphEventId: string,
  organizerEmail: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const enabled = await isCalendarSyncEnabled();
    if (!enabled) {
      return { success: false, error: "Teams calendar sync is not enabled" };
    }

    const token = await getAccessToken();

    const startDateTime = combineDateAndTime(session.session_date, session.start_time);
    const endDateTime = combineDateAndTime(session.session_date, session.end_time);

    const eventPayload: Record<string, any> = {
      subject: session.title || "ILT Session",
      body: {
        contentType: "HTML",
        content: buildEventBody(session),
      },
      start: {
        dateTime: startDateTime,
        timeZone: "UTC",
      },
      end: {
        dateTime: endDateTime,
        timeZone: "UTC",
      },
    };

    if (session.location) {
      eventPayload.location = { displayName: session.location };
    }

    const response = await fetch(
      `${GRAPH_BASE_URL}/users/${organizerEmail}/events/${graphEventId}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(eventPayload),
        signal: AbortSignal.timeout(15000),
      }
    );

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      return {
        success: false,
        error: `Graph API error (${response.status}): ${errorBody.slice(0, 300)}`,
      };
    }

    return { success: true };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Failed to update Teams calendar event",
    };
  }
}

// ─── Cancel Calendar Event ──────────────────────────────────────

/**
 * Cancel (delete) a Teams calendar event when an ILT session is cancelled.
 */
export async function cancelTeamsCalendarEvent(
  graphEventId: string,
  organizerEmail: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const enabled = await isCalendarSyncEnabled();
    if (!enabled) {
      return { success: false, error: "Teams calendar sync is not enabled" };
    }

    const token = await getAccessToken();

    const response = await fetch(
      `${GRAPH_BASE_URL}/users/${organizerEmail}/events/${graphEventId}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        signal: AbortSignal.timeout(15000),
      }
    );

    if (!response.ok && response.status !== 404) {
      const errorBody = await response.text().catch(() => "");
      return {
        success: false,
        error: `Graph API error (${response.status}): ${errorBody.slice(0, 300)}`,
      };
    }

    return { success: true };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Failed to cancel Teams calendar event",
    };
  }
}

// ─── Test Connection ────────────────────────────────────────────

/**
 * Test that the Azure AD credentials are valid by acquiring a token.
 */
export async function testCalendarConnection(): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    // Clear cached token to force a fresh request
    cachedToken = null;
    await getAccessToken();
    return { success: true };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Failed to authenticate with Azure AD",
    };
  }
}

// ─── Helpers ────────────────────────────────────────────────────

function combineDateAndTime(date: string, time: string): string {
  // Handle various date/time formats
  const datePart = date.split("T")[0]; // Get just YYYY-MM-DD
  // If time already includes seconds, use it; otherwise append :00
  const timePart = time.includes(":") && time.split(":").length >= 3 ? time : `${time}:00`;
  return `${datePart}T${timePart}`;
}

function buildEventBody(session: ILTSession): string {
  const parts = [
    `<h2>${session.title || "ILT Session"}</h2>`,
  ];

  if (session.description) {
    parts.push(`<p>${session.description}</p>`);
  }

  if (session.course_name) {
    parts.push(`<p><strong>Course:</strong> ${session.course_name}</p>`);
  }

  if (session.location) {
    parts.push(`<p><strong>Location:</strong> ${session.location}</p>`);
  }

  if (session.max_attendees) {
    parts.push(`<p><strong>Max Attendees:</strong> ${session.max_attendees}</p>`);
  }

  parts.push(
    `<hr><p><em>This event was created by LearnHub LMS Platform.</em></p>`
  );

  return parts.join("\n");
}

async function storeGraphEventId(
  sessionId: string,
  graphEventId: string
): Promise<void> {
  try {
    const service = createServiceClient();
    await service
      .from("ilt_sessions")
      .update({ graph_event_id: graphEventId })
      .eq("id", sessionId);
  } catch (err) {
    console.error("Failed to store Graph event ID:", err);
  }
}
