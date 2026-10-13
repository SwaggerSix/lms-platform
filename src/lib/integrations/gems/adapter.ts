import { GemsClient, gemsDatePart, gemsTimePart } from "./client";
import type {
  GemsAttendee,
  GemsConfig,
  GemsEvent,
  GemsEventFilter,
  GemsTrainingEvent,
} from "./types";

// ─────────────────────────────────────────────────────────────────
// GEMS adapter — maps GEMS TrainingEvent records onto the LMS's
// normalized GemsEvent shape consumed by the sync engine.
//
// READ-ONLY: only fetches from GEMS, never writes back.
//
// The attendee/roster endpoint is not yet known (no event with a filed
// roster was observed during capture). fetchAttendees is stubbed and
// returns [] until that endpoint is confirmed — see SUMMARY.md /
// "The Roster / Attendee Gap" in the integration brief.
// ─────────────────────────────────────────────────────────────────

/**
 * Map GEMS courseStatus → the LMS ilt_sessions.status enum.
 *
 * GEMS has no "completed": a class it still calls Scheduled after its end
 * date has been delivered, so it maps to "completed" once `today` (YYYY-MM-DD)
 * is past the end date. Postponed/Tentative/Development stay "scheduled";
 * the LMS has no closer status for them.
 */
export function mapStatus(
  courseStatus: string | undefined,
  endDate?: string | null,
  today?: string
): GemsEvent["status"] {
  switch ((courseStatus ?? "").toLowerCase()) {
    case "canceled":
    case "cancelled":
      return "cancelled";
    case "scheduled":
      return endDate && today && endDate < today ? "completed" : "scheduled";
    default:
      return "scheduled";
  }
}

export function normalizeEvent(
  raw: GemsTrainingEvent,
  today: string = new Date().toISOString().slice(0, 10)
): GemsEvent | null {
  const sessionDate = gemsDatePart(raw.startDate);
  // Without a real start date the row can't become an ilt_session.
  if (!sessionDate) return null;

  const course = raw.courseProduct;
  const location = raw.courseLocation;
  const title =
    course?.productDescription || raw.eventCode || `GEMS event ${raw.eventId}`;

  const locationParts = location
    ? [location.locationName, location.city, location.state, location.zip]
        .filter(Boolean)
        .join(", ")
    : undefined;

  return {
    external_id: String(raw.eventId),
    event_code: raw.eventCode,
    title,
    session_date: sessionDate,
    start_time: gemsTimePart(raw.startTime) ?? undefined,
    end_time: gemsTimePart(raw.endTime) ?? undefined,
    location_type: location?.isVirtual ? "virtual" : location ? "in_person" : undefined,
    location_details: locationParts || undefined,
    max_capacity: course?.max || undefined,
    status: mapStatus(raw.courseStatus, gemsDatePart(raw.endDate) ?? sessionDate, today),
    instructor_email: raw.instructor?.email || undefined,
    instructor_name:
      raw.instructor?.fullName ||
      [raw.instructor?.firstName, raw.instructor?.lastName].filter(Boolean).join(" ") ||
      undefined,
    course_name: course?.productDescription || undefined,
    course_code: course?.productCode || undefined,
    enrolled_count: raw.noOfStudents || undefined,
    has_roster: raw.roster === true,
    raw: raw as unknown as Record<string, unknown>,
  };
}

export class GemsHttpAdapter {
  readonly providerName = "GEMS";

  private client(config: GemsConfig): GemsClient {
    return new GemsClient(config);
  }

  async testConnection(config: GemsConfig) {
    return this.client(config).testConnection();
  }

  /**
   * Fetch events, one calendar year per search, from `fromYear` through
   * five years ahead. GEMS' POST /api/TrainingEvent treats an empty filter as
   * "match nothing" and has returned nothing for date-only strings, so each
   * window goes as full .NET datetimes. Searching a year at a time keeps one
   * capped response from hiding whole years; a window where GEMS reports more
   * matches than it returned comes back as a warning.
   */
  async fetchEvents(
    config: GemsConfig,
    opts: { fromYear?: number; today?: string } = {}
  ): Promise<{ events: GemsEvent[]; warnings: string[] }> {
    const today = opts.today ?? new Date().toISOString().slice(0, 10);
    const lastYear = Number(today.slice(0, 4)) + 5;
    const client = this.client(config);
    const byId = new Map<string, GemsEvent>();
    const warnings: string[] = [];
    for (let year = opts.fromYear ?? 2000; year <= lastYear; year++) {
      const filter: GemsEventFilter = {
        earliestDate: `${year}-01-01T00:00:00`,
        lastDate: `${year}-12-31T23:59:59`,
      };
      const { events, totalCount } = await client.searchTrainingEventsPage(filter);
      if (totalCount !== null && totalCount > events.length) {
        warnings.push(`GEMS returned ${events.length} of ${totalCount} events for ${year}; the rest were not synced`);
      }
      for (const raw of events) {
        const e = normalizeEvent(raw, today);
        if (e) byId.set(e.external_id, e);
      }
    }
    return { events: [...byId.values()], warnings };
  }

  /**
   * Fetch the attendee roster for an event.
   *
   * TODO(gems): the roster endpoint is unconfirmed. Per the integration
   * brief, capture the authenticated GET that fires when editing a past
   * event with noOfStudents > 0, then implement this. Returns [] for now
   * so event sync works without rosters.
   */
  async fetchAttendees(
    _config: GemsConfig,
    _eventExternalId: string
  ): Promise<GemsAttendee[]> {
    return [];
  }
}

export const gemsAdapter = new GemsHttpAdapter();
