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

/** Map GEMS courseStatus → the LMS ilt_sessions.status enum. */
export function mapStatus(courseStatus: string | undefined): GemsEvent["status"] {
  switch ((courseStatus ?? "").toLowerCase()) {
    case "canceled":
    case "cancelled":
      return "cancelled";
    case "scheduled":
    case "tentative":
    case "development":
    case "postponed":
      return "scheduled";
    default:
      return "scheduled";
  }
}

export function normalizeEvent(raw: GemsTrainingEvent): GemsEvent | null {
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
    status: mapStatus(raw.courseStatus),
    instructor_email: raw.instructor?.email || undefined,
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
   * Fetch events. Pass a filter (e.g. modifiedDate for incremental syncs);
   * defaults to a wide date range (2000-01-01 .. 5 years from now), because
   * GEMS' POST /api/TrainingEvent treats an empty filter as "match nothing"
   * — sending no earliestDate/lastDate yields zero events.
   */
  async fetchEvents(
    config: GemsConfig,
    filter: GemsEventFilter = {}
  ): Promise<GemsEvent[]> {
    // GEMS is .NET; pass full ISO 8601 datetimes (date-only strings have
    // produced empty results).
    const effective: GemsEventFilter = {
      earliestDate: "2000-01-01T00:00:00",
      lastDate: `${new Date().getUTCFullYear() + 5}-12-31T23:59:59`,
      ...filter,
    };
    const events = await this.client(config).searchTrainingEvents(effective);
    return events
      .map((e) => normalizeEvent(e))
      .filter((e): e is GemsEvent => e !== null);
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
