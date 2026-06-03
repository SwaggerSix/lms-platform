import * as XLSX from "xlsx";
import type { RosterAttendee, SharePointRostersConfig } from "./types";

// ─────────────────────────────────────────────────────────────────
// Roster .xlsx parser
//
// Roster files have varying layouts but follow a common shape:
//
//   #  | Learner Name        | Email Address    | Org   | Attended Day 1 | Attended Day 2 | ...
//
// Some "Grade Sheet" variants use "First Name" + "Last Name" instead of
// "Learner Name". The parser is tolerant: it finds the header row by
// scanning for an "Email" cell, then maps the columns it finds. Days
// attended are counted from any header cell containing "Attended" or
// matching "Day N".
// ─────────────────────────────────────────────────────────────────

const DEFAULT_ATTENDANCE_THRESHOLD = 0.8;

type Row = Array<string | number | boolean | null | undefined>;

function cellToString(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function isPresentMark(v: unknown): boolean {
  const s = cellToString(v).toLowerCase();
  if (!s) return false;
  return s === "x" || s === "p" || s === "y" || s === "yes" || s === "present" || s === "1" || s === "true";
}

function findHeaderRow(rows: Row[]): { headerIdx: number; columns: string[] } | null {
  for (let i = 0; i < Math.min(rows.length, 30); i++) {
    const row = rows[i].map(cellToString);
    const hasEmail = row.some((c) => /email/i.test(c));
    if (hasEmail) {
      return { headerIdx: i, columns: row };
    }
  }
  return null;
}

function classifyColumns(columns: string[]) {
  const idx = {
    email: -1,
    full_name: -1,
    first_name: -1,
    last_name: -1,
    org: -1,
    days: [] as number[],
  };
  columns.forEach((raw, i) => {
    const c = raw.toLowerCase();
    if (idx.email < 0 && /email/i.test(c)) idx.email = i;
    else if (idx.full_name < 0 && /(learner|attendee|student|full)\s*name/i.test(c)) idx.full_name = i;
    else if (idx.first_name < 0 && /first\s*name/i.test(c)) idx.first_name = i;
    else if (idx.last_name < 0 && /last\s*name/i.test(c)) idx.last_name = i;
    else if (idx.org < 0 && /(org|organization|agency|unit)/i.test(c)) idx.org = i;
    if (/attend|^day\s*\d+/i.test(c)) idx.days.push(i);
  });
  return idx;
}

/**
 * Parse a roster .xlsx buffer into normalized attendee rows.
 *
 * @param buffer  raw bytes of the .xlsx file
 * @param config  used for the attendance threshold (defaults to 80%)
 */
export function parseRoster(
  buffer: ArrayBuffer,
  config: Pick<SharePointRostersConfig, "attendance_threshold">
): RosterAttendee[] {
  const wb = XLSX.read(buffer, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return [];

  const rows = XLSX.utils.sheet_to_json<Row>(sheet, { header: 1, defval: null });
  const header = findHeaderRow(rows);
  if (!header) return [];

  const cols = classifyColumns(header.columns);
  if (cols.email < 0) return [];

  const threshold = config.attendance_threshold ?? DEFAULT_ATTENDANCE_THRESHOLD;
  const attendees: RosterAttendee[] = [];

  for (let i = header.headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    const email = cellToString(row[cols.email]).toLowerCase();
    if (!email || !email.includes("@")) continue;

    const full_name = cols.full_name >= 0
      ? cellToString(row[cols.full_name])
      : [cols.first_name, cols.last_name]
          .filter((c) => c >= 0)
          .map((c) => cellToString(row[c]))
          .filter(Boolean)
          .join(" ") || undefined;

    const org = cols.org >= 0 ? cellToString(row[cols.org]) : undefined;

    const days_total = cols.days.length;
    const days_attended = cols.days.reduce(
      (sum, c) => sum + (isPresentMark(row[c]) ? 1 : 0),
      0
    );

    const present_ratio = days_total > 0 ? days_attended / days_total : 0;
    const attendance_status: RosterAttendee["attendance_status"] =
      present_ratio >= threshold ? "present" : "absent";

    attendees.push({
      email,
      full_name: full_name || undefined,
      org: org || undefined,
      days_total,
      days_attended,
      attendance_status,
    });
  }

  return attendees;
}
