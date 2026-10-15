// ─────────────────────────────────────────────────────────────────
// Which SharePoint class folder belongs to a session.
//
// _Courses isn't organized by GEMS course code: classes are filed by
// customer, course name or category, at any depth, e.g.
//   _Courses/DOE/FY26/2026.08.04 DOE Federal Appropriations Law & PIA/
//   _Courses/NASA 2026/FCR 404 COR Refresher/2026.10.05 - NASA/
//   _Courses/AI Literacy/2026.07.21 NAVFAC/
// What every class folder shares is its start date at the front of its name
// ("YYYY.MM.DD …"). So the sync finds the folders dated the session's start
// date anywhere under the root, and when several classes started that day,
// picks the one whose name and path best match what the session knows
// about itself (title, course, course code, customer).
// ─────────────────────────────────────────────────────────────────

export interface FolderCandidate {
  id: string;
  name: string;
  /** Path of the folder's parent, e.g. "/drive/root:/_Courses/DOE/FY26". */
  parentPath: string;
}

export interface SessionHints {
  session_date: string;
  title?: string | null;
  course_title?: string | null;
  course_code?: string | null;
  customer_name?: string | null;
  customer_code?: string | null;
}

export type FolderMatch =
  | { kind: "match"; folder: FolderCandidate }
  | { kind: "none" }
  | { kind: "ambiguous"; folders: FolderCandidate[] };

/** "2026-08-04" → "2026.08.04", the prefix class folders start with. */
export function dateFolderPrefix(sessionDate: string): string {
  return sessionDate.replace(/-/g, ".");
}

// Words too common in course and folder names to tell classes apart.
const STOP = new Set([
  "the", "and", "for", "with", "course", "courses", "training", "class", "hrs", "virtual", "fy",
  "rt", "ld", "cm", "mg", "ac", "gr", "sb",
]);

function words(s: string): string[] {
  return s
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3 && !STOP.has(w) && !/^\d{1,4}$/.test(w));
}

const compact = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Same word, or the same stem ("write" / "writing", "manage" / "management"). */
function sameWord(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.length < 4 || b.length < 4) return false;
  let n = 0;
  while (n < a.length && n < b.length && a[n] === b[n]) n++;
  return n >= 4 && n >= Math.min(a.length, b.length) - 2;
}

/** "Business Writing & Email Etiquette" → "bwee": folders often use a course's initials. */
function initials(text: string): string | null {
  const w = words(text.replace(/\(.*?\)/g, ""));
  return w.length >= 3 ? w.map((x) => x[0]).join("") : null;
}

/** How well a folder's name and path fit the session: shared words, plus codes or initials found verbatim. */
export function scoreFolder(folder: FolderCandidate, hints: SessionHints): number {
  const haystack = `${folder.parentPath} ${folder.name}`;
  const have = words(haystack);
  const tokens = new Set(haystack.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean));
  const packed = compact(haystack);
  let score = 0;

  const hintText = [hints.title, hints.course_title, hints.customer_name].filter(Boolean).join(" ");
  for (const w of new Set(words(hintText))) if (have.some((h) => sameWord(w, h))) score += 1;

  for (const t of [hints.title, hints.course_title]) {
    const abbr = t ? initials(t) : null;
    if (abbr && tokens.has(abbr)) score += 3;
  }

  // Codes like "FGR402" / "FCR 404" / "DOE": match ignoring spacing.
  for (const code of [hints.course_code, hints.customer_code]) {
    const c = code ? compact(code) : "";
    if (c.length >= 3 && packed.includes(c)) score += 3;
  }
  return score;
}

/**
 * The session's class folder among the dated folders found: the only one, or
 * the clear best fit. Ties (or several folders and nothing to tell them
 * apart) are reported as ambiguous rather than guessed.
 */
export function pickClassFolder(candidates: FolderCandidate[], hints: SessionHints): FolderMatch {
  const prefix = dateFolderPrefix(hints.session_date);
  const dated = candidates.filter((f) => f.name.startsWith(prefix));
  if (dated.length === 0) return { kind: "none" };
  if (dated.length === 1) return { kind: "match", folder: dated[0] };

  const scored = dated
    .map((folder) => ({ folder, score: scoreFolder(folder, hints) }))
    .sort((a, b) => b.score - a.score);
  if (scored[0].score > 0 && scored[0].score > scored[1].score) return { kind: "match", folder: scored[0].folder };
  const best = scored.filter((s) => s.score === scored[0].score).map((s) => s.folder);
  return { kind: "ambiguous", folders: best };
}

// Workbooks in a class folder that aren't the roster.
const NOT_ROSTER = /eval|survey|score|certificate|cert\b|sign[\s-]?up|invoice/i;

/**
 * The class's roster workbook: the final one where several versions exist
 * ("… FINAL.xlsx" over "… Day 1.xlsx" or "Copy of …"), then anything named
 * "roster", newest first; never evaluations, certificates or the like.
 */
export function pickRosterFile<T extends { name: string; lastModifiedDateTime: string; file?: unknown }>(files: T[]): T | null {
  const xlsx = files.filter((f) => f.file && f.name.toLowerCase().endsWith(".xlsx") && !NOT_ROSTER.test(f.name));
  if (xlsx.length === 0) return null;
  const rank = (f: T) =>
    (/final/i.test(f.name) ? 4 : 0) + (/roster|attendance|sign[\s-]?in/i.test(f.name) ? 2 : 0) - (/day\s*\d|^copy of/i.test(f.name) ? 3 : 0);
  return [...xlsx].sort((a, b) => rank(b) - rank(a) || b.lastModifiedDateTime.localeCompare(a.lastModifiedDateTime))[0];
}
