/**
 * Capstone hand-in for staff-awarded credentials.
 *
 * A credential with `certifications.capstone_key` asks the learner for work
 * the assessor marks by hand before Award: for Mosaic Certified, the G3 memo
 * and the G4 recorded briefing plus three pushback questions drawn at random
 * (MOS-100 M10, surveycraft docs/training/mosaic-certification/modules/M10-capstone.md).
 *
 * Pure rules and content live here; database work is in capstone-service.ts.
 */

export type CapstoneKind = "memo" | "briefing";
export type SubmissionStatus = "submitted" | "passed" | "resubmit" | "not_passed";

export interface PushbackPrompt {
  speaker: string;
  text: string;
}

export interface CapstoneConfig {
  title: string;
  intro: string;
  memo: { title: string; instructions: string[] };
  briefing: { title: string; instructions: string[] };
  pushback: { count: number; prepSeconds: number; answerSeconds: number; bank: PushbackPrompt[] };
  turnaround: string;
}

export const CAPSTONES: Record<string, CapstoneConfig> = {
  "mosaic-practitioner": {
    title: "Capstone: The Northwind Health Board Briefing",
    intro:
      "Hand in your interpretation memo and your recorded executive briefing here. Dr. Chris Cancialosi scores both, usually within 10 business days. If a piece doesn't meet the bar yet, you'll get specific feedback and one resubmission.",
    memo: {
      title: "Task 1: Interpretation memo (Gate G3)",
      instructions: [
        "No more than two pages, to Dana Okafor (CEO) and Alex Moreau (CPO).",
        "3 to 5 findings, each with the claim, the evidence (exhibits and numbers), your confidence and why, and the so-what for Northwind.",
        "At least two things the data can't tell us yet.",
        "Recommendations: what Northwind should do next, and which Mosaic tool, if any, should measure it and when.",
        "A short confidentiality note: what you will and won't show the board, and why.",
        "Upload a PDF or Word document.",
      ],
    },
    briefing: {
      title: "Task 2: Recorded executive briefing (Gate G4)",
      instructions: [
        "Record a 10–12 minute briefing for Northwind's board and executive team, as you'd deliver it on November 18.",
        "Use up to 5 slides or exhibits, with your camera on and your slides visible (a screen-share recording is fine).",
        "Paste a link to the recording (Loom, unlisted YouTube, Google Drive or OneDrive with view access), or upload a video file up to 50 MB.",
        "Then answer three pushback questions, shown one at a time only after you hand in the briefing. You get 60 seconds to think before each one and up to 2 minutes to answer, recorded here on your camera.",
      ],
    },
    pushback: {
      count: 3,
      prepSeconds: 60,
      answerSeconds: 120,
      bank: [
        { speaker: "Board member", text: "64% response rate, then 47%. How do I know the people who didn't answer aren't the unhappy ones?" },
        { speaker: "CFO", text: "We spent eight months on this. Two of three areas didn't move. Wasn't it a waste?" },
        { speaker: "CNO", text: "Nursing is lowest on Collaboration. Is this saying my nurses are the problem?" },
        { speaker: "Board chair", text: "Which of the executives is the weak link on empowering people? Your chart has a dot way down at the bottom." },
        { speaker: "COO (Jordan)", text: "Can we just get the comments from the Clinic Network so we can see who's unhappy?" },
        { speaker: "CEO", text: "Our Purpose score is 88th percentile. Can we tell the board our culture drives our patient satisfaction?" },
        { speaker: "Board member", text: "What's the benchmark? Are we above or below other health systems?" },
        { speaker: "VP Clinic Ops", text: "The Pharmacy team told me they're struggling. Why aren't they in your report?" },
      ],
    },
    turnaround: "about 10 business days",
  },
};

export const CAPSTONE_BUCKET = "certification-submissions";
export const MAX_FILE_BYTES = 50 * 1024 * 1024;
export const MAX_ATTEMPTS = 2;

/** What may be uploaded for each slot, by MIME type. */
export const ALLOWED_TYPES: Record<"memo" | "briefing" | "pushback", Record<string, string>> = {
  memo: {
    "application/pdf": "pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  },
  briefing: { "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov" },
  pushback: { "video/webm": "webm", "video/mp4": "mp4", "video/quicktime": "mov" },
};

export function capstoneFor(key: string | null | undefined): CapstoneConfig | null {
  return key && Object.prototype.hasOwnProperty.call(CAPSTONES, key) ? CAPSTONES[key] : null;
}

/** A recording link must be an https URL; we never fetch it, the assessor opens it. */
export function isAcceptableLink(raw: string): boolean {
  try {
    const u = new URL(raw.trim());
    return u.protocol === "https:" && !!u.hostname && u.hostname.includes(".") && raw.length <= 2000;
  } catch {
    return false;
  }
}

/** `n` distinct prompt indexes from a bank of `size`. */
export function drawPrompts(size: number, n: number, rand: () => number = Math.random): number[] {
  const idx = Array.from({ length: size }, (_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return idx.slice(0, Math.min(n, size));
}

export interface SubmissionLike {
  kind: CapstoneKind;
  attempt: number;
  status: SubmissionStatus;
  reviewed_at: string | null;
}

/** The newest attempt of one kind, or null. */
export function latestOf<T extends SubmissionLike>(subs: T[], kind: CapstoneKind): T | null {
  return subs.filter((s) => s.kind === kind).sort((a, b) => b.attempt - a.attempt)[0] ?? null;
}

/**
 * Whether the learner may hand in (another) piece of this kind, and which
 * attempt it would be. First time: attempt 1. After "resubmit": attempt 2.
 */
export function nextAttempt(subs: SubmissionLike[], kind: CapstoneKind): number | null {
  const last = latestOf(subs, kind);
  if (!last) return 1;
  if (last.status === "resubmit" && last.attempt < MAX_ATTEMPTS) return last.attempt + 1;
  return null;
}

/** The decisions an assessor may record on an attempt. A second attempt can't be sent back again. */
export function allowedDecisions(attempt: number): SubmissionStatus[] {
  return attempt < MAX_ATTEMPTS ? ["passed", "resubmit"] : ["passed", "not_passed"];
}

/** Dates (YYYY-MM-DD) both pieces passed, when both have. */
export function passDates(subs: SubmissionLike[]): { memo: string; briefing: string } | null {
  const m = latestOf(subs, "memo");
  const b = latestOf(subs, "briefing");
  if (m?.status !== "passed" || b?.status !== "passed" || !m.reviewed_at || !b.reviewed_at) return null;
  return { memo: m.reviewed_at.slice(0, 10), briefing: b.reviewed_at.slice(0, 10) };
}

/** Seconds between a pushback question being shown and the answer arriving. */
export function answerSeconds(revealedAt: string | null, answeredAt: string | null): number | null {
  if (!revealedAt || !answeredAt) return null;
  return Math.round((new Date(answeredAt).getTime() - new Date(revealedAt).getTime()) / 1000);
}

/** Over prep + answer time, with a minute's grace for the upload. Shown to the assessor, never enforced. */
export function answeredLate(cfg: CapstoneConfig, seconds: number | null): boolean {
  return seconds != null && seconds > cfg.pushback.prepSeconds + cfg.pushback.answerSeconds + 60;
}
