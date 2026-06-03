// ─────────────────────────────────────────────────────────────────
// SharePoint roster integration — types
//
// Roster files (.xlsx) live in a SharePoint site at:
//   {site}/Shared Documents/{root_folder}/{CourseCode}/
//     {YYYY.MM.DD ...}/*.xlsx
//
// We link a roster file to a GEMS-imported ILT session by matching
// (course code, session start date) against the folder structure.
// Older classes also live under {root_folder}/_Archive/{CourseCode}/...
// which we fall back to when no current-year folder matches.
// ─────────────────────────────────────────────────────────────────

export interface SharePointRostersConfig {
  /** Azure AD tenant id (shared with the GEMS integration). */
  tenant_id: string;
  /** App registration client id (the same SP used for GEMS, with Graph permissions). */
  client_id: string;
  /** Client secret (encrypted at rest). */
  client_secret_encrypted: string;
  /**
   * SharePoint site host + path, e.g. "alishq.sharepoint.com:/sites/AMCIFileShare".
   * Used to resolve the site id via Microsoft Graph.
   */
  site_path: string;
  /** Drive (document library) name; defaults to "Documents". */
  drive_name?: string;
  /** Root folder inside the drive, e.g. "_Courses". */
  root_folder: string;
  /** Optional archive subfolder under root, e.g. "_Archive". */
  archive_folder?: string;
  /**
   * Attendance threshold (fraction of days present required to count as "present").
   * Defaults to 0.8 (80%).
   */
  attendance_threshold?: number;
}

/** A parsed attendee row from a roster spreadsheet. */
export interface RosterAttendee {
  email: string;
  full_name?: string;
  org?: string;
  days_total: number;
  days_attended: number;
  /** Derived from days_attended / days_total vs. attendance_threshold. */
  attendance_status: "present" | "absent";
}

/** Result of locating + parsing one roster file. */
export interface ParsedRoster {
  /** Microsoft Graph driveItem id of the .xlsx that was parsed. */
  drive_item_id: string;
  /** Filename for logging. */
  file_name: string;
  attendees: RosterAttendee[];
}
