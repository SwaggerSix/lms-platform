/**
 * Capstone rules (no I/O, so they can be tested directly).
 *
 * A capstone-gated certification (migration 20261111120000) opens once every
 * required course on its learning path is completed. Each attempt is one
 * capstone_submissions row, marked by an assessor:
 *
 *   submitted  waiting to be marked (at most one at a time)
 *   passed     the certificate was issued
 *   not_yet    feedback returned. While attempts remain the learner may
 *              resubmit; after the last allowed attempt they need a call with
 *              the assessor, who may then allow one more attempt.
 */

export type CapstoneStatus = "submitted" | "passed" | "not_yet";

export interface CapstoneAttempt {
  attempt: number;
  status: CapstoneStatus;
  another_attempt_allowed: boolean;
}

export type CapstoneState =
  | { kind: "locked" } // path not finished yet
  | { kind: "open"; nextAttempt: number } // may submit
  | { kind: "waiting"; attempt: number } // submitted, being marked
  | { kind: "passed"; attempt: number }
  | { kind: "needs_call"; attempt: number }; // out of attempts until the assessor allows another

/** Business days the assessor commits to (operator decision, 2026-11-11). */
export const MARKING_BUSINESS_DAYS = 10;

/** Where a learner stands, from their attempts (any order) and the path. */
export function capstoneState(
  attempts: CapstoneAttempt[],
  maxAttempts: number,
  pathComplete: boolean
): CapstoneState {
  const sorted = [...attempts].sort((a, b) => a.attempt - b.attempt);
  const passed = sorted.find((a) => a.status === "passed");
  if (passed) return { kind: "passed", attempt: passed.attempt };

  const latest = sorted[sorted.length - 1];
  if (latest?.status === "submitted") return { kind: "waiting", attempt: latest.attempt };

  if (!pathComplete) return { kind: "locked" };
  if (!latest) return { kind: "open", nextAttempt: 1 };

  // latest is not_yet
  if (latest.attempt < maxAttempts || latest.another_attempt_allowed) {
    return { kind: "open", nextAttempt: latest.attempt + 1 };
  }
  return { kind: "needs_call", attempt: latest.attempt };
}

/** Is this the last attempt allowed before a call is needed? */
export function isFinalAllowedAttempt(attempt: number, maxAttempts: number): boolean {
  return attempt >= maxAttempts;
}

/** Add whole calendar months, clamping to the last day of a shorter month. */
export function addMonths(from: Date, months: number): Date {
  const d = new Date(from.getTime());
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d;
}

/** The date `days` business days (Mon–Fri) after `from`. */
export function addBusinessDays(from: Date, days: number): Date {
  const d = new Date(from.getTime());
  let left = days;
  while (left > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    const wd = d.getUTCDay();
    if (wd !== 0 && wd !== 6) left--;
  }
  return d;
}

// ── Files and links ────────────────────────────────────────────────────

export const CAPSTONE_BUCKET = "capstones";
export const MAX_CAPSTONE_FILE_BYTES = 50 * 1024 * 1024;
export const MAX_CAPSTONE_FILES = 10;
export const MAX_CAPSTONE_LINKS = 10;

/** Mirrors the bucket's allowed_mime_types (migration 20261111120000). */
export const CAPSTONE_FILE_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
};

/** The content type for an allowed file name, or null when it isn't allowed. */
export function capstoneContentType(fileName: string): string | null {
  const ext = fileName.toLowerCase().split(".").pop() ?? "";
  return CAPSTONE_FILE_TYPES[ext] ?? null;
}

/** A storage-safe version of a file name (keeps the extension). */
export function safeFileName(fileName: string): string {
  const base = fileName.split(/[\\/]/).pop() ?? "file";
  const cleaned = base.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^[-.]+/, "");
  return (cleaned || "file").slice(-120);
}

/** Every file of a learner's capstone lives under this prefix. */
export function capstonePrefix(userId: string, certificationId: string): string {
  return `${userId}/${certificationId}/`;
}

/** Only files the learner uploaded for this certification may be submitted. */
export function isOwnCapstonePath(path: string, userId: string, certificationId: string): boolean {
  const prefix = capstonePrefix(userId, certificationId);
  return path.startsWith(prefix) && !path.includes("..") && path.length > prefix.length;
}

/** Links must be absolute https URLs (a video host, a shared drive…). */
export function isAcceptableLink(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && !!u.hostname && u.hostname.includes(".");
  } catch {
    return false;
  }
}
