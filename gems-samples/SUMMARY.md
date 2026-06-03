# GEMS API — Integration Reference

GEMS is a Blazor WebAssembly (.NET 8) application at
`https://gems-api.azurewebsites.net`. Its data layer is a REST API at
`/api/*` on the same host. It is **not** public — every call requires an
Azure AD bearer token.

> Capture the live `events.json` and `attendees.json` from a local,
> authenticated browser session and drop them next to this file. They are
> git-ignored intentionally if they contain client data — see the note at
> the bottom.

## Auth

| Field | Value |
| --- | --- |
| Protocol | OAuth 2.0 / MSAL, Azure AD |
| Tenant ID | `30295520-84b7-447c-ba6d-3a2b11790cd4` |
| Client App ID (Blazor front-end) | `d94cb67d-8789-47b5-bd70-943cbf1b0361` |
| Backend API App ID URI | `api://d9fbbe9d-7bd0-4ede-b9a7-e2c90c1d1d5f` |
| Required scope | `Gems.Access` (client-credentials uses `{apiAppIdUri}/.default`) |
| Header | `Authorization: Bearer <token>` |

Server-side integration uses the **client-credentials** flow with a
service principal that the GEMS admin must add to the backend API app.

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/TrainingEvent` | Search/filter event list (read; body is a filter) |
| GET | `/api/TrainingEvent/{eventId}` | Full event detail (187 fields). `eventId` is an **integer** (e.g. 2548), not `eventCode` ("2026-049") |
| GET | `/api/Instructor` | Instructor lookup |
| GET | `/api/Customer/` | Customer/agency lookup |
| GET | `/api/CourseProduct` | Course catalog |
| GET | `/api/CourseLocation` | Locations |
| GET | `/api/Division` | Divisions |
| GET | `/api/SIN`, `/api/CustomerPO`, `/api/Airport/`, `/api/ProgramManager/`, ... | Other reference data |

### POST /api/TrainingEvent filter fields
`earliestDate, lastDate, createdDate, modifiedDate, instructor, customer,
course, eventCode, status, division, invoiceCode, cpoTaskOrderSentDate,
expenseUploadStatus`

## TrainingEvent — fields used by the LMS

| GEMS field | Type | LMS mapping |
| --- | --- | --- |
| `eventId` | int | `ilt_sessions.external_id` (idempotency key) |
| `eventCode` | string `YYYY-NNN` | stored for reference |
| `courseStatus` | string | → `status` (Scheduled/Tentative/Development/Postponed → `scheduled`; Canceled → `cancelled`) |
| `startDate` / `endDate` | ISO8601 | `session_date` (date part) |
| `startTime` / `endTime` | ISO8601 | `start_time` / `end_time` (time part) |
| `courseProduct.productDescription` | string | session `title` / course match |
| `courseProduct.productCode` | string | `course_code` |
| `courseProduct.max` | int | `max_capacity` |
| `customer.customerName` | string | (agency, informational) |
| `instructor.email` | string | matched to LMS `users` → `instructor_id` |
| `courseLocation.isVirtual` | bool | `location_type` (virtual / in_person) |
| `courseLocation.{locationName,city,state,zip}` | string | `location_details` |
| `noOfStudents` | int | enrolled count (post-roster) |
| `roster` | bool | true = roster filed (gate for attendee sync) |

**Sentinel:** `"0001-01-01T00:00:00"` = .NET `DateTime.MinValue` = "not set" →
treated as `null` (`parseGemsDate` in `client.ts`).

## The Roster / Attendee Gap (OPEN)

The per-attendee list (names, emails, agencies) is **not** in the event
detail. It loads via a separate authenticated call that fires only when
`roster === true`, and was never observed during capture (all available
events had `roster: false`).

To close this gap:
1. Chrome DevTools → Network → filter XHR/Fetch
2. Open `https://gems-api.azurewebsites.net/Events`, filter to a past year
3. Find an event with `noOfStudents > 0`, click its edit (pencil) button
4. Capture the authenticated GET that loads the roster — URL, headers, response schema
5. Report it back; `fetchAttendees` in `adapter.ts` will be implemented against it

## LMS-side implementation (this repo)

- `src/lib/integrations/gems/auth.ts` — MSAL client-credentials token provider
- `src/lib/integrations/gems/types.ts` — TrainingEvent schema, config, normalized shapes
- `src/lib/integrations/gems/client.ts` — typed read-only client + sentinel-date helpers
- `src/lib/integrations/gems/adapter.ts` — TrainingEvent → normalized GemsEvent
- `src/lib/integrations/gems/sync.ts` — upsert into `ilt_sessions` / `ilt_attendance`
- `src/app/api/cron/gems-sync/route.ts` — scheduled sync (every 6h via `vercel.json`)
- Admin "Sync now" → `POST /api/integrations/external/{id}/sync`
- Migration: `supabase/migrations/20260318100033_gems_integration.sql`

## Note on sample data

`events.json` / `attendees.json` may contain real client/agency data. If
so, do **not** commit them — keep them local or scrub PII first. This
`SUMMARY.md` contains only schema/endpoint metadata and is safe to commit.
