import { createServiceClient } from "@/lib/supabase/service";
import crypto from "crypto";

// ─── Types ───────────────────────────────────────────────────────

export type MeetingProvider = "zoom" | "teams" | "google_meet" | "custom";

export interface MeetingResult {
  meeting_url: string;
  meeting_id: string;
  meeting_password: string | null;
  join_url: string;
  host_url: string;
}

export interface SessionData {
  title: string;
  description?: string;
  session_date: string;
  start_time: string;
  end_time: string;
  timezone: string;
  meeting_url?: string;
}

interface VCIntegration {
  id: string;
  provider: string;
  is_active: boolean;
  client_id: string | null;
  client_secret_encrypted: string | null;
  access_token_encrypted: string | null;
  refresh_token_encrypted: string | null;
  token_expires_at: string | null;
  settings: Record<string, unknown>;
}

// ─── Encryption helpers ──────────────────────────────────────────
// In production, use a proper KMS (AWS KMS, Vault, etc.)
// This uses AES-256-GCM with a key derived from an environment variable.

const ENCRYPTION_KEY = process.env.VC_ENCRYPTION_KEY;
if (!ENCRYPTION_KEY && process.env.NODE_ENV === "production") {
  console.error("CRITICAL: VC_ENCRYPTION_KEY is not set. Video conferencing secrets will not be encrypted securely.");
}
const EFFECTIVE_ENCRYPTION_KEY = ENCRYPTION_KEY || "dev-only-key-not-for-production!!";

function getEncryptionKey(): Buffer {
  // Ensure we have a 32-byte key for AES-256
  return crypto.createHash("sha256").update(EFFECTIVE_ENCRYPTION_KEY).digest();
}

export function encryptSecret(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // Format: iv:authTag:encrypted (all base64)
  return `${iv.toString("base64")}:${authTag.toString("base64")}:${encrypted.toString("base64")}`;
}

export function decryptSecret(ciphertext: string): string {
  const key = getEncryptionKey();
  const parts = ciphertext.split(":");
  if (parts.length !== 3) throw new Error("Invalid encrypted format");
  const iv = Buffer.from(parts[0], "base64");
  const authTag = Buffer.from(parts[1], "base64");
  const encrypted = Buffer.from(parts[2], "base64");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString("utf8");
}

// ─── Integration credential loader ──────────────────────────────

async function getIntegration(provider: string): Promise<VCIntegration> {
  const service = createServiceClient();
  const { data, error } = await service
    .from("vc_integrations")
    .select("*")
    .eq("provider", provider)
    .eq("is_active", true)
    .single();

  if (error || !data) {
    throw new Error(
      `${provider} integration is not configured. Go to Admin > Settings > Integrations to set up ${provider}.`
    );
  }

  return data as VCIntegration;
}

function getDecryptedTokens(integration: VCIntegration) {
  const clientId = integration.client_id;
  const clientSecret = integration.client_secret_encrypted
    ? decryptSecret(integration.client_secret_encrypted)
    : null;
  const accessToken = integration.access_token_encrypted
    ? decryptSecret(integration.access_token_encrypted)
    : null;
  const refreshToken = integration.refresh_token_encrypted
    ? decryptSecret(integration.refresh_token_encrypted)
    : null;

  if (!clientId || !clientSecret) {
    throw new Error(
      `${integration.provider} credentials are incomplete. Please reconfigure the integration.`
    );
  }

  return { clientId, clientSecret, accessToken, refreshToken };
}

// ─── Helper: build datetime from session ─────────────────────────

function buildStartDateTime(session: SessionData): string {
  return `${session.session_date}T${session.start_time}:00`;
}

function buildEndDateTime(session: SessionData): string {
  return `${session.session_date}T${session.end_time}:00`;
}

function durationMinutes(session: SessionData): number {
  const [sh, sm] = session.start_time.split(":").map(Number);
  const [eh, em] = session.end_time.split(":").map(Number);
  return (eh * 60 + em) - (sh * 60 + sm);
}

// ─── Create Meeting ──────────────────────────────────────────────

export async function createMeeting(
  provider: MeetingProvider,
  sessionData: SessionData
): Promise<MeetingResult> {
  if (provider === "custom") {
    return createCustomMeeting(sessionData);
  }
  if (provider === "zoom") {
    return createZoomMeeting(sessionData);
  }
  if (provider === "teams") {
    return createTeamsMeeting(sessionData);
  }
  if (provider === "google_meet") {
    return createGoogleMeetMeeting(sessionData);
  }
  throw new Error(`Unsupported meeting provider: ${provider}`);
}

async function createCustomMeeting(sessionData: SessionData): Promise<MeetingResult> {
  const url = sessionData.meeting_url || "";
  if (!url) {
    throw new Error("A meeting URL is required for custom meeting provider.");
  }
  return {
    meeting_url: url,
    meeting_id: `custom-${Date.now()}`,
    meeting_password: null,
    join_url: url,
    host_url: url,
  };
}

async function createZoomMeeting(sessionData: SessionData): Promise<MeetingResult> {
  const integration = await getIntegration("zoom");
  const { accessToken } = getDecryptedTokens(integration);

  if (!accessToken) {
    throw new Error(
      "Zoom access token not available. Please reconnect your Zoom integration."
    );
  }

  const settings = integration.settings as Record<string, unknown>;
  const duration = durationMinutes(sessionData);

  // Zoom Create Meeting API: POST https://api.zoom.us/v2/users/me/meetings
  const requestBody = {
    topic: sessionData.title,
    type: 2, // Scheduled meeting
    start_time: buildStartDateTime(sessionData),
    duration,
    timezone: sessionData.timezone,
    agenda: sessionData.description || "",
    settings: {
      host_video: true,
      participant_video: true,
      join_before_host: false,
      mute_upon_entry: settings.mute_on_entry !== false,
      waiting_room: settings.waiting_room !== false,
      auto_recording: settings.auto_record ? "cloud" : "none",
      meeting_authentication: false,
    },
  };

  const response = await fetch("https://api.zoom.us/v2/users/me/meetings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Zoom API error (${response.status}): ${err}`);
  }

  const data = await response.json();

  return {
    meeting_url: data.join_url,
    meeting_id: String(data.id),
    meeting_password: data.password || null,
    join_url: data.join_url,
    host_url: data.start_url,
  };
}

async function createTeamsMeeting(sessionData: SessionData): Promise<MeetingResult> {
  const integration = await getIntegration("teams");
  const { accessToken } = getDecryptedTokens(integration);

  if (!accessToken) {
    throw new Error(
      "Microsoft Teams access token not available. Please reconnect your Teams integration."
    );
  }

  const startDateTime = buildStartDateTime(sessionData);
  const endDateTime = buildEndDateTime(sessionData);

  const settings = integration.settings as Record<string, unknown>;

  // Microsoft Graph: POST /me/onlineMeetings
  const requestBody = {
    startDateTime: `${startDateTime}`,
    endDateTime: `${endDateTime}`,
    subject: sessionData.title,
    lobbyBypassSettings: {
      scope: settings.waiting_room === false ? "everyone" : "organizer",
      isDialInBypassEnabled: false,
    },
    isEntryExitAnnounced: true,
    allowedPresenters: "organizer",
    recordAutomatically: !!settings.auto_record,
  };

  const response = await fetch("https://graph.microsoft.com/v1.0/me/onlineMeetings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Microsoft Graph API error (${response.status}): ${err}`);
  }

  const data = await response.json();

  return {
    meeting_url: data.joinWebUrl,
    meeting_id: data.id,
    meeting_password: null,
    join_url: data.joinWebUrl,
    host_url: data.joinWebUrl,
  };
}

async function createGoogleMeetMeeting(sessionData: SessionData): Promise<MeetingResult> {
  const integration = await getIntegration("google_meet");
  const { accessToken } = getDecryptedTokens(integration);

  if (!accessToken) {
    throw new Error(
      "Google access token not available. Please reconnect your Google Meet integration."
    );
  }

  const startDateTime = buildStartDateTime(sessionData);
  const endDateTime = buildEndDateTime(sessionData);

  // Google Calendar API: POST /calendars/primary/events with conferenceDataVersion=1
  const requestBody = {
    summary: sessionData.title,
    description: sessionData.description || "",
    start: {
      dateTime: startDateTime,
      timeZone: sessionData.timezone,
    },
    end: {
      dateTime: endDateTime,
      timeZone: sessionData.timezone,
    },
    conferenceData: {
      createRequest: {
        requestId: `lms-${Date.now()}`,
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    },
  };

  const response = await fetch(
    "https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Google Calendar API error (${response.status}): ${err}`);
  }

  const data = await response.json();
  const meetLink =
    data.conferenceData?.entryPoints?.find(
      (ep: { entryPointType: string; uri: string }) => ep.entryPointType === "video"
    )?.uri || data.hangoutLink || "";

  return {
    meeting_url: meetLink,
    meeting_id: data.id,
    meeting_password: null,
    join_url: meetLink,
    host_url: meetLink,
  };
}

// ─── Update Meeting ──────────────────────────────────────────────

export async function updateMeeting(
  provider: MeetingProvider,
  meetingId: string,
  updates: Partial<SessionData>
): Promise<void> {
  if (provider === "custom") {
    // Nothing to update externally for custom URLs
    return;
  }

  if (provider === "zoom") {
    return updateZoomMeeting(meetingId, updates);
  }
  if (provider === "teams") {
    return updateTeamsMeeting(meetingId, updates);
  }
  if (provider === "google_meet") {
    return updateGoogleMeetMeeting(meetingId, updates);
  }
}

async function updateZoomMeeting(meetingId: string, updates: Partial<SessionData>): Promise<void> {
  const integration = await getIntegration("zoom");
  const { accessToken } = getDecryptedTokens(integration);

  if (!accessToken) {
    throw new Error("Zoom access token not available. Please reconnect your Zoom integration.");
  }

  const body: Record<string, unknown> = {};
  if (updates.title) body.topic = updates.title;
  if (updates.description !== undefined) body.agenda = updates.description;
  if (updates.session_date && updates.start_time) {
    body.start_time = `${updates.session_date}T${updates.start_time}:00`;
  }
  if (updates.start_time && updates.end_time) {
    const [sh, sm] = updates.start_time.split(":").map(Number);
    const [eh, em] = updates.end_time.split(":").map(Number);
    body.duration = (eh * 60 + em) - (sh * 60 + sm);
  }
  if (updates.timezone) body.timezone = updates.timezone;

  const response = await fetch(`https://api.zoom.us/v2/meetings/${meetingId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Zoom API error updating meeting (${response.status}): ${err}`);
  }
}

async function updateTeamsMeeting(meetingId: string, updates: Partial<SessionData>): Promise<void> {
  const integration = await getIntegration("teams");
  const { accessToken } = getDecryptedTokens(integration);

  if (!accessToken) {
    throw new Error("Teams access token not available. Please reconnect your Teams integration.");
  }

  const body: Record<string, unknown> = {};
  if (updates.title) body.subject = updates.title;
  if (updates.session_date && updates.start_time) {
    body.startDateTime = `${updates.session_date}T${updates.start_time}:00`;
  }
  if (updates.session_date && updates.end_time) {
    body.endDateTime = `${updates.session_date}T${updates.end_time}:00`;
  }

  const response = await fetch(
    `https://graph.microsoft.com/v1.0/me/onlineMeetings/${meetingId}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Microsoft Graph API error updating meeting (${response.status}): ${err}`);
  }
}

async function updateGoogleMeetMeeting(
  meetingId: string,
  updates: Partial<SessionData>
): Promise<void> {
  const integration = await getIntegration("google_meet");
  const { accessToken } = getDecryptedTokens(integration);

  if (!accessToken) {
    throw new Error("Google access token not available. Please reconnect your Google Meet integration.");
  }

  const body: Record<string, unknown> = {};
  if (updates.title) body.summary = updates.title;
  if (updates.description !== undefined) body.description = updates.description;
  if (updates.session_date && updates.start_time) {
    body.start = {
      dateTime: `${updates.session_date}T${updates.start_time}:00`,
      timeZone: updates.timezone || "UTC",
    };
  }
  if (updates.session_date && updates.end_time) {
    body.end = {
      dateTime: `${updates.session_date}T${updates.end_time}:00`,
      timeZone: updates.timezone || "UTC",
    };
  }

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${meetingId}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Google Calendar API error updating event (${response.status}): ${err}`);
  }
}

// ─── Delete Meeting ──────────────────────────────────────────────

export async function deleteMeeting(
  provider: MeetingProvider,
  meetingId: string
): Promise<void> {
  if (provider === "custom") {
    return; // Nothing to delete externally
  }

  if (provider === "zoom") {
    return deleteZoomMeeting(meetingId);
  }
  if (provider === "teams") {
    return deleteTeamsMeeting(meetingId);
  }
  if (provider === "google_meet") {
    return deleteGoogleMeetMeeting(meetingId);
  }
}

async function deleteZoomMeeting(meetingId: string): Promise<void> {
  const integration = await getIntegration("zoom");
  const { accessToken } = getDecryptedTokens(integration);

  if (!accessToken) return;

  const response = await fetch(`https://api.zoom.us/v2/meetings/${meetingId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok && response.status !== 404) {
    const err = await response.text();
    throw new Error(`Zoom API error deleting meeting (${response.status}): ${err}`);
  }
}

async function deleteTeamsMeeting(meetingId: string): Promise<void> {
  const integration = await getIntegration("teams");
  const { accessToken } = getDecryptedTokens(integration);

  if (!accessToken) return;

  const response = await fetch(
    `https://graph.microsoft.com/v1.0/me/onlineMeetings/${meetingId}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!response.ok && response.status !== 404) {
    const err = await response.text();
    throw new Error(`Microsoft Graph API error deleting meeting (${response.status}): ${err}`);
  }
}

async function deleteGoogleMeetMeeting(meetingId: string): Promise<void> {
  const integration = await getIntegration("google_meet");
  const { accessToken } = getDecryptedTokens(integration);

  if (!accessToken) return;

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${meetingId}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!response.ok && response.status !== 404 && response.status !== 410) {
    const err = await response.text();
    throw new Error(`Google Calendar API error deleting event (${response.status}): ${err}`);
  }
}

// ─── ICS File Generation ─────────────────────────────────────────

interface ICSSessionData {
  title: string;
  description?: string | null;
  session_date: string;
  start_time: string;
  end_time: string;
  timezone: string;
  location_details?: string | null;
  meeting_url?: string | null;
  instructor_name?: string;
}

function formatICSDate(date: string, time: string): string {
  // Format: 20260318T140000
  const d = date.replace(/-/g, "");
  const t = time.replace(/:/g, "").padEnd(6, "0");
  return `${d}T${t}`;
}

function escapeICSText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

function foldICSLine(line: string): string {
  // RFC 5545: lines should be no longer than 75 octets
  const result: string[] = [];
  let remaining = line;
  while (remaining.length > 75) {
    result.push(remaining.substring(0, 75));
    remaining = " " + remaining.substring(75);
  }
  result.push(remaining);
  return result.join("\r\n");
}

export function generateICSFile(session: ICSSessionData): string {
  const uid = `${Date.now()}-${Math.random().toString(36).substring(2)}@lms-platform`;
  const now = new Date();
  const dtstamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

  const dtStart = formatICSDate(session.session_date, session.start_time);
  const dtEnd = formatICSDate(session.session_date, session.end_time);

  const descriptionParts: string[] = [];
  if (session.description) {
    descriptionParts.push(session.description);
  }
  if (session.meeting_url) {
    descriptionParts.push(`Join meeting: ${session.meeting_url}`);
  }
  if (session.instructor_name) {
    descriptionParts.push(`Instructor: ${session.instructor_name}`);
  }
  const description = escapeICSText(descriptionParts.join("\n\n"));

  const location = session.meeting_url
    ? escapeICSText(session.meeting_url)
    : session.location_details
    ? escapeICSText(session.location_details)
    : "";

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//LMS Platform//Video Conferencing//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    foldICSLine(`UID:${uid}`),
    foldICSLine(`DTSTAMP:${dtstamp}`),
    foldICSLine(`DTSTART;TZID=${session.timezone}:${dtStart}`),
    foldICSLine(`DTEND;TZID=${session.timezone}:${dtEnd}`),
    foldICSLine(`SUMMARY:${escapeICSText(session.title)}`),
  ];

  if (description) {
    lines.push(foldICSLine(`DESCRIPTION:${description}`));
  }
  if (location) {
    lines.push(foldICSLine(`LOCATION:${location}`));
  }
  if (session.meeting_url) {
    lines.push(foldICSLine(`URL:${session.meeting_url}`));
  }

  lines.push("STATUS:CONFIRMED");
  lines.push("BEGIN:VALARM");
  lines.push("TRIGGER:-PT15M");
  lines.push("ACTION:DISPLAY");
  lines.push("DESCRIPTION:Session starting in 15 minutes");
  lines.push("END:VALARM");
  lines.push("END:VEVENT");
  lines.push("END:VCALENDAR");

  return lines.join("\r\n");
}
