// ─────────────────────────────────────────────────────────────────
// GEMS adapter
//
// GEMS is a proprietary training scheduling system. This adapter reads
// scheduled events (and their attendee rosters) from the GEMS REST API
// so they can be imported into the LMS as ilt_sessions / ilt_attendance.
//
// IMPORTANT: this is a one-way, READ-ONLY adapter. It only ever issues
// GET requests to GEMS. It never creates, updates, or deletes anything
// in GEMS — GEMS remains the system of record for scheduling.
//
// The exact GEMS payload shape was not available when this was written
// (the API host was unreachable from the build environment). The
// normalizers below accept several common field-name variants; once a
// real /Events payload is confirmed, tighten `normalizeEvent` /
// `normalizeAttendee` to the actual field names. Search for "TODO(gems)".
// ─────────────────────────────────────────────────────────────────

export interface GemsConfig {
  /** Base URL of the GEMS API, e.g. https://gems-api.azurewebsites.net */
  base_url?: string;
  /** API key / token for GEMS. Prefer a READ-ONLY credential. */
  api_key_encrypted?: string;
  /** How the api key is sent: bearer token or `X-Api-Key` header. */
  auth_scheme?: "bearer" | "api_key";
  /** Optional path override for the events listing (default: /Events). */
  events_path?: string;
}

/** A scheduled training event as exposed by GEMS, normalized. */
export interface GemsEvent {
  /** Stable GEMS event id — used as the idempotency key. */
  external_id: string;
  title: string;
  description?: string;
  /** ISO date (YYYY-MM-DD) of the session. */
  session_date: string;
  /** HH:MM[:SS] local start time. */
  start_time?: string;
  /** HH:MM[:SS] local end time. */
  end_time?: string;
  timezone?: string;
  location_type?: "virtual" | "in_person" | "hybrid";
  location_details?: string;
  meeting_url?: string;
  max_capacity?: number;
  status?: "scheduled" | "in_progress" | "completed" | "cancelled";
  /** Email of the instructor, used to match an LMS user. */
  instructor_email?: string;
  /** Free-text course/program name, used to match or create an LMS course. */
  course_name?: string;
  /** Anything we didn't map, kept for traceability. */
  raw?: Record<string, unknown>;
}

/** A single attendee/registration row for a GEMS event, normalized. */
export interface GemsAttendee {
  /** Stable GEMS roster-entry id (idempotency key); falls back to event+email. */
  external_id: string;
  event_external_id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  registration_status?: "registered" | "waitlisted" | "cancelled";
  attendance_status?: "present" | "absent" | "late" | "excused" | "no_show";
  completion_status?: "not_started" | "in_progress" | "completed" | "failed";
  score?: number;
}

export interface GemsAdapter {
  readonly providerName: string;
  testConnection(config: GemsConfig): Promise<{ success: boolean; message: string }>;
  fetchEvents(config: GemsConfig): Promise<GemsEvent[]>;
  fetchAttendees(config: GemsConfig, eventExternalId: string): Promise<GemsAttendee[]>;
}

// ─── Helpers ─────────────────────────────────────────────────────

function authHeaders(config: GemsConfig): Record<string, string> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (config.api_key_encrypted) {
    if (config.auth_scheme === "api_key") {
      headers["X-Api-Key"] = config.api_key_encrypted;
    } else {
      headers.Authorization = `Bearer ${config.api_key_encrypted}`;
    }
  }
  return headers;
}

function requireBaseUrl(config: GemsConfig): string {
  if (!config.base_url) throw new Error("GEMS base_url is required");
  return config.base_url.replace(/\/+$/, "");
}

/** Read the first present key from a record, given several candidates. */
function pick(obj: Record<string, any>, ...keys: string[]): any {
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null && obj[k] !== "") return obj[k];
  }
  return undefined;
}

function normalizeLocationType(value: unknown): GemsEvent["location_type"] {
  const v = String(value ?? "").toLowerCase();
  if (v.includes("person") || v === "onsite" || v === "classroom") return "in_person";
  if (v.includes("hybrid")) return "hybrid";
  if (v) return "virtual";
  return undefined;
}

function normalizeStatus(value: unknown): GemsEvent["status"] {
  const v = String(value ?? "").toLowerCase();
  if (v.includes("cancel")) return "cancelled";
  if (v.includes("complete") || v === "done" || v === "closed") return "completed";
  if (v.includes("progress") || v === "active" || v === "live") return "in_progress";
  if (v) return "scheduled";
  return undefined;
}

// TODO(gems): align these field names with the real /Events payload.
export function normalizeEvent(raw: Record<string, any>): GemsEvent | null {
  const external_id = pick(raw, "id", "eventId", "EventId", "EventID", "guid")?.toString();
  const title = pick(raw, "title", "name", "Title", "Name", "eventName");
  const dateValue = pick(raw, "session_date", "date", "startDate", "StartDate", "eventDate", "start");
  if (!external_id || !title || !dateValue) return null;

  const startIso = new Date(dateValue);
  const session_date = isNaN(startIso.getTime())
    ? String(dateValue).slice(0, 10)
    : startIso.toISOString().slice(0, 10);

  return {
    external_id,
    title: String(title),
    description: pick(raw, "description", "Description", "details"),
    session_date,
    start_time: pick(raw, "start_time", "startTime", "StartTime"),
    end_time: pick(raw, "end_time", "endTime", "EndTime"),
    timezone: pick(raw, "timezone", "timeZone", "TimeZone"),
    location_type: normalizeLocationType(pick(raw, "location_type", "locationType", "deliveryMode", "format")),
    location_details: pick(raw, "location", "Location", "venue", "address"),
    meeting_url: pick(raw, "meeting_url", "meetingUrl", "joinUrl", "url"),
    max_capacity: Number(pick(raw, "max_capacity", "capacity", "Capacity", "seats")) || undefined,
    status: normalizeStatus(pick(raw, "status", "Status", "state")),
    instructor_email: pick(raw, "instructor_email", "instructorEmail", "facilitatorEmail", "trainerEmail"),
    course_name: pick(raw, "course_name", "courseName", "program", "Program", "courseTitle"),
    raw,
  };
}

// TODO(gems): align these field names with the real attendee/roster payload.
export function normalizeAttendee(
  raw: Record<string, any>,
  eventExternalId: string
): GemsAttendee | null {
  const email = pick(raw, "email", "Email", "attendeeEmail", "workEmail");
  if (!email) return null;

  const rosterId = pick(raw, "id", "registrationId", "RegistrationId")?.toString();

  const reg = String(pick(raw, "registration_status", "registrationStatus", "status") ?? "").toLowerCase();
  const att = String(pick(raw, "attendance_status", "attendanceStatus", "attendance") ?? "").toLowerCase();

  return {
    external_id: rosterId ?? `${eventExternalId}:${email}`,
    event_external_id: eventExternalId,
    email: String(email),
    first_name: pick(raw, "first_name", "firstName", "FirstName"),
    last_name: pick(raw, "last_name", "lastName", "LastName"),
    registration_status: reg.includes("wait")
      ? "waitlisted"
      : reg.includes("cancel")
        ? "cancelled"
        : "registered",
    attendance_status: (["present", "absent", "late", "excused", "no_show"] as const).find((s) =>
      att.includes(s.replace("_", ""))
    ),
    completion_status: undefined,
    score: Number(pick(raw, "score", "Score")) || undefined,
  };
}

/** Unwrap a JSON response that may be a bare array or `{ data|items|events: [...] }`. */
function asArray(data: any): Record<string, any>[] {
  if (Array.isArray(data)) return data;
  return data?.data ?? data?.items ?? data?.events ?? data?.Events ?? [];
}

// ─── Adapter implementation ──────────────────────────────────────

export class GemsHttpAdapter implements GemsAdapter {
  readonly providerName = "GEMS";

  async testConnection(config: GemsConfig): Promise<{ success: boolean; message: string }> {
    try {
      const base = requireBaseUrl(config);
      const path = config.events_path || "/Events";
      const response = await fetch(`${base}${path}`, { headers: authHeaders(config) });
      if (response.ok) {
        return { success: true, message: "Successfully connected to GEMS" };
      }
      return { success: false, message: `GEMS returned status ${response.status}` };
    } catch (error) {
      return {
        success: false,
        message: `Connection failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  async fetchEvents(config: GemsConfig): Promise<GemsEvent[]> {
    const base = requireBaseUrl(config);
    const path = config.events_path || "/Events";
    const response = await fetch(`${base}${path}`, { headers: authHeaders(config) });
    if (!response.ok) {
      throw new Error(`GEMS API error: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    return asArray(data)
      .map((row) => normalizeEvent(row))
      .filter((e): e is GemsEvent => e !== null);
  }

  async fetchAttendees(config: GemsConfig, eventExternalId: string): Promise<GemsAttendee[]> {
    const base = requireBaseUrl(config);
    // TODO(gems): confirm the real roster endpoint. Common patterns:
    //   /Events/{id}/Attendees  or  /Events/{id}/Registrations
    const response = await fetch(`${base}/Events/${encodeURIComponent(eventExternalId)}/Attendees`, {
      headers: authHeaders(config),
    });
    if (response.status === 404) return [];
    if (!response.ok) {
      throw new Error(`GEMS attendees API error: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    return asArray(data)
      .map((row) => normalizeAttendee(row, eventExternalId))
      .filter((a): a is GemsAttendee => a !== null);
  }
}

export const gemsAdapter = new GemsHttpAdapter();
