// ─────────────────────────────────────────────────────────────────
// GEMS API types
//
// GEMS is a Blazor WASM (.NET 8) app; its data layer is a REST API at
// /api/* secured by Azure AD bearer tokens. These types mirror the
// subset of the TrainingEvent schema (187 fields total) that the LMS
// integration actually consumes, plus the config and normalized shapes.
//
// .NET DateTime fields serialize as ISO 8601. The sentinel
// "0001-01-01T00:00:00" is DateTime.MinValue and means "not set" — it
// must be treated as null (see parseGemsDate in client.ts).
// ─────────────────────────────────────────────────────────────────

// ─── Connection config (stored in external_integrations.config) ──

export interface GemsConfig {
  /** Azure AD tenant id (directory). */
  tenant_id: string;
  /** App registration (client) id of the service principal calling GEMS. */
  client_id: string;
  /**
   * Client secret for the service principal. Stored encrypted at rest in
   * external_integrations.config; the field name keeps the `_encrypted`
   * suffix used elsewhere in the integrations layer.
   */
  client_secret_encrypted: string;
  /** Backend API App ID URI, e.g. "api://d9fbbe9d-7bd0-4ede-b9a7-e2c90c1d1d5f". */
  api_app_id_uri: string;
  /** Base URL of the GEMS host, e.g. "https://gems-api.azurewebsites.net". */
  api_base: string;
  /**
   * Auth mode. Defaults to "app_only" (client-credentials flow).
   *
   * Use "delegated" when the GEMS backend only accepts delegated tokens
   * (i.e., it checks `scp: Gems.Access` and rejects app-only `roles`
   * claims). In that mode the LMS authenticates as a designated service
   * account user via ROPC; service_user_email and
   * service_user_password_encrypted become required.
   *
   * The service account must:
   *   - have access to the GEMS API,
   *   - have MFA disabled / be excluded from Conditional Access MFA
   *     (ROPC fails for MFA-protected accounts),
   *   - belong to a managed (not federated) identity provider.
   */
  auth_mode?: "app_only" | "delegated";
  /** Delegated mode only: email/UPN of the designated service account user. */
  service_user_email?: string;
  /** Delegated mode only: password for the service account user (encrypted at rest). */
  service_user_password_encrypted?: string;
  /**
   * OAuth scope override. Defaults are:
   *   app_only:  "{api_app_id_uri}/.default"
   *   delegated: "{api_app_id_uri}/Gems.Access"
   */
  scope?: string;
}

// ─── Raw GEMS API shapes (nested objects as returned by /api/*) ──

export interface GemsCourseProduct {
  courseProductId: number;
  productDescription: string;
  productCode: string;
  min: number;
  max: number;
  sinnumber: string;
}

export interface GemsCustomer {
  customerId: number;
  customerName: string;
  customerCode: string;
}

export interface GemsInstructor {
  instructorId: number;
  fullName: string;
  email: string;
}

export interface GemsCourseLocation {
  locationName: string;
  city: string;
  state: string;
  zip: string;
  isVirtual: boolean;
}

/** A GEMS TrainingEvent (relevant subset of 187 fields). */
export interface GemsTrainingEvent {
  eventId: number;
  eventCode: string;
  courseStatus: string; // Scheduled | Canceled | Postponed | Tentative | Development
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  length: number;
  state: string;
  courseProduct: GemsCourseProduct | null;
  customer: GemsCustomer | null;
  instructor: GemsInstructor | null;
  courseLocation: GemsCourseLocation | null;
  noOfStudents: number;
  roster: boolean;
  evaluations: boolean;
  instructorScore: number;
  overallScore: number;
  [key: string]: unknown; // remaining fields preserved but untyped
}

/** Filter body for POST /api/TrainingEvent. All fields optional. */
export interface GemsEventFilter {
  earliestDate?: string;
  lastDate?: string;
  createdDate?: string;
  modifiedDate?: string;
  instructor?: string;
  customer?: string;
  course?: string;
  eventCode?: string;
  status?: string;
  division?: string;
  invoiceCode?: string;
  cpoTaskOrderSentDate?: string;
  expenseUploadStatus?: string;
}

// ─── Normalized shapes consumed by the sync engine ───────────────

export interface GemsEvent {
  /** Stable GEMS primary key (eventId), used as the idempotency key. */
  external_id: string;
  /** Human-readable code, e.g. "2026-049". */
  event_code?: string;
  title: string;
  description?: string;
  /** ISO date (YYYY-MM-DD); null sentinel dates are dropped upstream. */
  session_date: string;
  start_time?: string;
  end_time?: string;
  timezone?: string;
  location_type?: "virtual" | "in_person" | "hybrid";
  location_details?: string;
  meeting_url?: string;
  max_capacity?: number;
  status?: "scheduled" | "in_progress" | "completed" | "cancelled";
  instructor_email?: string;
  /** Course title — matched against LMS courses. */
  course_name?: string;
  /** GEMS course catalog code. */
  course_code?: string;
  /** Enrolled count from GEMS (populated after roster submission). */
  enrolled_count?: number;
  /** True once a post-training roster has been filed in GEMS. */
  has_roster?: boolean;
  raw?: Record<string, unknown>;
}

export interface GemsAttendee {
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
