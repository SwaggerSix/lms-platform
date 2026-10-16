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
  return s === "x" || s === "p" || s === "y" || s === "yes" || s === "present" || s === "1" || s === "true" || s === "✓" || s === "✔";
}

/** An explicit "didn't come": NS (also "NS-missing due to …"), no show, absent, A, N, No, 0. */
function isAbsentMark(v: unknown): boolean {
  const s = cellToString(v).toLowerCase();
  return /^ns\b|^ns[a-z]?$|^no[\s-]?show|^absent/.test(s) || s === "a" || s === "n" || s === "no" || s === "0";
}

const MONTH = "(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\\.?";

/**
 * A header naming a class day: "05/29/2024", "2024-05-29", "22-Jun",
 * "August 4, 2026", "Aug 4", or an Excel date serial.
 */
function isDateHeader(raw: string): boolean {
  const c = raw.trim();
  if (/^\d{1,2}\/\d{1,2}(\/\d{2,4})?$/.test(c) || /^\d{4}-\d{2}-\d{2}$/.test(c)) return true;
  if (new RegExp(`^\\d{1,2}[-\\s]${MONTH}([-\\s]\\d{2,4})?$`, "i").test(c)) return true;
  if (new RegExp(`^${MONTH}\\s+\\d{1,2}(,?\\s+\\d{4})?$`, "i").test(c)) return true;
  const n = Number(c);
  return Number.isInteger(n) && n > 40000 && n < 60000; // 2009–2064 as Excel serials
}

/** A column heading for email ("Email", "Email Address", "Work Email", "Learner's Work Email"), not a title that mentions email. */
function isEmailHeader(c: string): boolean {
  return /^((work|learner'?s?|participant'?s?)\s+)*(work\s+)?e-?mail(\s+address)?$/i.test(c.trim());
}

/**
 * The column-heading row: the first row with an email heading. Falls back to
 * any short cell mentioning email, so a title like "Business Writing and Email
 * Etiquette" above the table isn't mistaken for it.
 */
function findHeaderRow(rows: Row[]): { headerIdx: number; columns: string[] } | null {
  const limit = Math.min(rows.length, 30);
  for (const looksLikeHeader of [isEmailHeader, (c: string) => /email/i.test(c) && c.length <= 40]) {
    for (let i = 0; i < limit; i++) {
      const row = (rows[i] ?? []).map(cellToString);
      if (row.filter(Boolean).length >= 2 && row.some(looksLikeHeader)) return { headerIdx: i, columns: row };
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
    else if (
      idx.full_name < 0 &&
      (/(learner|attendee|student|participant|full)\s*name/i.test(c) || /^name$|last,\s*first|^(registered\s+)?attendees?$/i.test(c))
    ) idx.full_name = i;
    else if (idx.first_name < 0 && /first\s*name/i.test(c)) idx.first_name = i;
    else if (idx.last_name < 0 && /last\s*name/i.test(c)) idx.last_name = i;
    else if (idx.org < 0 && /(org|organization|agency|unit)/i.test(c)) idx.org = i;
    // Attendance columns: "Attended Day 1", "Attendance", "Day 2", a sign-in
    // "Signature" column, or one dated column per class day. ("Attendees"
    // names people, not days.)
    if (/attended|attendance|^day\s*\d+|^signature$|sign[\s-]?in/i.test(c) || isDateHeader(raw)) idx.days.push(i);
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
    // A second table (e.g. "Administrative Staff": POC, instructors) ends the roster.
    if (row.some((c) => isEmailHeader(cellToString(c)))) break;
    const emailCell = cellToString(row[cols.email]).toLowerCase();
    const email = emailCell.includes("@") ? emailCell : null;

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

    // Present when marked present on enough days; absent only when marked
    // absent (NS, Absent…). A row with no marks (a registration list, a walk-in
    // added at the bottom, a totals row) says nothing about who came.
    const marked_absent = cols.days.some((c) => isAbsentMark(row[c]));
    // No email: keep a late add listed by name, but only with attendance
    // marks, so totals rows, notes and staff without marks stay out.
    if (!email && !(isPersonName(full_name) && (days_attended > 0 || marked_absent))) continue;
    const attendance_status: RosterAttendee["attendance_status"] =
      days_attended > 0
        ? days_attended / days_total >= threshold ? "present" : "absent"
        : marked_absent ? "absent" : "unknown";

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

/** A person's name as rosters write it ("Shari Taylor", "Taylor, Shari"): two or more words, no digits or email. */
function isPersonName(name: string | undefined): name is string {
  if (!name || name.length > 60 || /[\d@]/.test(name)) return false;
  return name.split(/[\s,]+/).filter((w) => /^[a-z][a-z.'-]*$/i.test(w)).length >= 2;
}
