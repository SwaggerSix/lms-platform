/**
 * Capstone hand-in for staff-awarded credentials.
 *
 * A credential with `certifications.capstone_key` asks the learner for work
 * the assessor marks by hand before Award (the `pieces` of its config).
 *
 * - **Mosaic Practitioner Certified** (operator decision 2026-11-11): ONE
 *   certification for the $599 bundle, MOS-100 + MOS-230 + MOS-240, and ONE
 *   capstone on the Northwind Health case that opens once all three courses
 *   are finished. Its pieces are the MOS-100 interpretation memo, the Culture
 *   Dig plan and synthesis (MOS-230's practical, folded in), the Mosaic
 *   Signal analysis memo (MOS-240's, folded in) and the recorded executive
 *   briefing with three pushback questions. The separate Culture Dig and
 *   Mosaic Signal Specialist certifications are retired.
 * - **Coaching Studio and SurveyCraft Specialist** (MOS-210, MOS-220) stay
 *   stand-alone, each with its own practical.
 *
 * Content comes from surveycraft docs/training/<course>/modules/*-M6/M10.
 * Pure rules and content live here; database work is in capstone-service.ts.
 */

export const CAPSTONE_KINDS = ["memo", "dig", "signal", "briefing", "practical"] as const;
export type CapstoneKind = (typeof CAPSTONE_KINDS)[number];
export type SubmissionStatus = "submitted" | "passed" | "resubmit" | "not_passed";
export type FileKind = "document" | "video";

export interface PushbackPrompt {
  speaker: string;
  text: string;
}

/** One piece of work the learner hands in and the assessor marks. */
export interface PieceConfig {
  kind: CapstoneKind;
  /** Short label for chips and the assessor ("Memo (G3)"). */
  label: string;
  /** In sentences ("interpretation memo"). */
  noun: string;
  title: string;
  instructions: string[];
  /** What a file must be. */
  file: FileKind;
  /**
   * How a link is used: "none" (file only), "or-file" (a link instead of a
   * file), "required" (a link and a file).
   */
  link: "none" | "or-file" | "required";
  linkLabel?: string;
  /** A short text the learner must give (e.g. the survey's exact name). */
  requiredNote?: string;
  /** Shown above the hand-in in amber (e.g. the practice site is wiped monthly). */
  warning?: string;
  /** Three pushback questions follow this piece (Mosaic briefing). */
  pushback?: boolean;
}

export interface CapstoneConfig {
  title: string;
  intro: string;
  /** One line for the learner's My Certifications card. */
  summary: string;
  pieces: PieceConfig[];
  pushback: { count: number; prepSeconds: number; answerSeconds: number; bank: PushbackPrompt[] } | null;
  turnaround: string;
}

const ASSESSOR =
  "Dr. Chris Cancialosi scores it, usually within 10 business days. If any criterion is below 3, you'll get written feedback and one resubmission; if the resubmission doesn't pass either, he'll set up a call with you.";

const practical = (p: Omit<PieceConfig, "kind" | "label" | "noun" | "file" | "link"> & Partial<PieceConfig>): PieceConfig => ({
  kind: "practical",
  label: "Practical (G3)",
  noun: "practical task",
  file: "document",
  link: "none",
  ...p,
});

export const CAPSTONES: Record<string, CapstoneConfig> = {
  "mosaic-practitioner": {
    title: "Capstone: Northwind Health",
    intro:
      "One client, three tools. Hand in four pieces of work on Northwind Health: the Culture Mosaic memo, the Culture Dig plan and synthesis, the Mosaic Signal memo, and your recorded board briefing that brings them together. Dr. Chris Cancialosi scores each, usually within 10 business days. If a piece doesn't meet the bar yet, you'll get written feedback and one resubmission; if the resubmission doesn't either, he'll set up a call with you. Pass all four and you're Mosaic Practitioner Certified for five years.",
    summary: "Hand in the four pieces of your Northwind capstone. It opens once you've finished MOS-100, MOS-230 and MOS-240.",
    pieces: [
      {
        kind: "memo",
        label: "Culture Mosaic memo",
        noun: "interpretation memo",
        title: "Task 1: Culture Mosaic interpretation memo",
        file: "document",
        link: "none",
        instructions: [
          "No more than two pages, to Dana Okafor (CEO) and Alex Moreau (CPO).",
          "3 to 5 findings, each with the claim, the evidence (exhibits and numbers), your confidence and why, and the so-what for Northwind.",
          "At least two things the data can't tell us yet.",
          "Recommendations: what Northwind should do next, and which Mosaic tool, if any, should measure it and when.",
          "A short confidentiality note: what you will and won't show the board, and why.",
          "Upload a PDF or Word document.",
        ],
      },
      // MOS-230 · docs/training/culture-dig-certification/modules/CD-M6-practical-task.md
      {
        kind: "dig",
        label: "Culture Dig",
        noun: "Culture Dig plan and synthesis",
        title: "Task 2: Culture Dig plan and synthesis memo",
        file: "document",
        link: "none",
        instructions: [
          "One Word or PDF document with Part A (program plan and fieldwork plan for Taylor Brooks's clinic dig), then Part B (the two-page synthesis memo for Alex Moreau). Use the MOS-230 templates.",
          "Before you hand in: Part A has all eight sections and two domain fieldwork plans; Part B has a headline, three findings, limits and recommendations.",
          "Nothing in either part names or points to an individual, and you haven't promised anything the dig can't deliver.",
        ],
      },
      // MOS-240 · docs/training/mosaic-signal-certification/modules/MS-M6-practical.md
      {
        kind: "signal",
        label: "Mosaic Signal",
        noun: "Mosaic Signal analysis memo",
        title: "Task 3: Mosaic Signal analysis memo",
        file: "document",
        link: "none",
        instructions: [
          "No more than two pages, to Alex Moreau.",
          "Patterns (3 to 5), outlier stories (2 or 3), cautions, a recommended next wave, and a short confidentiality note.",
          "Paraphrase stories and remove identifying details. Don't present any group under 10 stories, and don't try to work out who wrote anything.",
          "Upload a PDF or Word file.",
        ],
      },
      {
        kind: "briefing",
        label: "Briefing",
        noun: "board briefing",
        title: "Task 4: Recorded board briefing",
        file: "video",
        link: "or-file",
        linkLabel: "…or paste a link to the recording",
        pushback: true,
        instructions: [
          "Record a 10–12 minute briefing for Northwind's board and executive team, as you'd deliver it on November 18. Bring the three tools together: what the Culture Mosaic shows, what the dig and the stories add, and what you recommend next.",
          "Use up to 5 slides or exhibits, with your camera on and your slides visible (a screen-share recording is fine).",
          "Paste a link to the recording (Loom, unlisted YouTube, Google Drive or OneDrive with view access), or upload a video file up to 50 MB.",
          "Then answer three pushback questions, shown one at a time only after you hand in the briefing. You get 60 seconds to think before each one and up to 2 minutes to answer, recorded here on your camera.",
        ],
      },
    ],
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

  // MOS-210 · docs/training/coaching-studio-certification/modules/CS-M6-practical-and-certification.md
  "coaching-studio-specialist": {
    title: "Practical: Sam Whitfield's coaching engagement",
    intro: `Hand in your practical task here. ${ASSESSOR}`,
    summary: "Hand in your practical task for marking. The course exam alone doesn't certify you.",
    pieces: [
      practical({
        title: "Practical task (Gate G3)",
        warning:
          "The practice site (practice.mosaiccoachingstudio.com) is wiped on the 1st of each month. Take your screenshots and hand in during the same month.",
        instructions: [
          "One PDF or Word file with Part 1 and Part 2.",
          "Part 1: the completed Engagement Set-up Record, with screenshots of Sam's engagement as you built it on the practice site, and your reason for each choice.",
          "Part 2: your first-session plan (no more than one page) and your privacy reflection.",
          "Don't include anything about a real coachee. Everything you need is in the brief.",
        ],
      }),
    ],
    pushback: null,
    turnaround: "about 10 business days",
  },

  // MOS-220 · docs/training/surveycraft-certification/modules/SC-M6-practical.md
  "surveycraft-specialist": {
    title: "Practical: Northwind's decision-rights pulse",
    intro: `Hand in your practical task here. The assessor opens your survey in the Mosaic Practice Workspace to check its settings and logic, and takes it from your link. ${ASSESSOR}`,
    summary: "Hand in your practical survey build for marking. The course exam alone doesn't certify you.",
    pieces: [
      practical({
        title: "Practical task (Gate G3)",
        link: "required",
        linkLabel: "The survey's published link",
        requiredNote: "The survey's exact name in the Mosaic Practice Workspace",
        warning:
          "The practice workspace is wiped on the 1st of every month, your survey with it. Hand in before the month ends and keep your own copy of the rationale and screenshots. If you resubmit in a new month, rebuild the survey first.",
        instructions: [
          "The survey's published link and its exact name in the Mosaic Practice Workspace.",
          "One PDF or Word file with your one-page design rationale and two screenshots from your test run, taken before you deleted the test responses: one chart showing the logic worked, and one Compare Two Questions table.",
          "Don't distribute the survey. Describe your roster and link plan in the rationale instead.",
        ],
      }),
    ],
    pushback: null,
    turnaround: "about 10 business days",
  },
};

export const CAPSTONE_BUCKET = "certification-submissions";
export const MAX_FILE_BYTES = 50 * 1024 * 1024;
export const MAX_ATTEMPTS = 2;

/** What may be uploaded, by file kind, as MIME type → extension. */
export const ALLOWED_TYPES: Record<FileKind, Record<string, string>> = {
  document: {
    "application/pdf": "pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  },
  video: { "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov" },
};

/** "a", "a and b", "a, b and c". */
export function listOf(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

export function capstoneFor(key: string | null | undefined): CapstoneConfig | null {
  return key && Object.prototype.hasOwnProperty.call(CAPSTONES, key) ? CAPSTONES[key] : null;
}

export function pieceOf(cfg: CapstoneConfig, kind: string): PieceConfig | null {
  return cfg.pieces.find((p) => p.kind === kind) ?? null;
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
  /** Set when the assessor reopened a not-passed piece after the call. */
  reopened_at?: string | null;
}

/** The newest attempt of one kind, or null. */
export function latestOf<T extends SubmissionLike>(subs: T[], kind: CapstoneKind): T | null {
  return subs.filter((s) => s.kind === kind).sort((a, b) => b.attempt - a.attempt)[0] ?? null;
}

/**
 * Whether the learner may hand in (another) piece of this kind, and which
 * attempt it would be. First time: attempt 1. After "resubmit": attempt 2.
 * After "not passed" only if the assessor reopened it (after the call): the
 * next attempt, which is then marked Pass or Not passed.
 */
export function nextAttempt(subs: SubmissionLike[], kind: CapstoneKind): number | null {
  const last = latestOf(subs, kind);
  if (!last) return 1;
  if (last.status === "resubmit" && last.attempt < MAX_ATTEMPTS) return last.attempt + 1;
  // Failed twice, then reopened by the assessor after the call: one more.
  if (last.status === "not_passed" && last.reopened_at) return last.attempt + 1;
  return null;
}

/** The decisions an assessor may record on an attempt. A second attempt can't be sent back again. */
export function allowedDecisions(attempt: number): SubmissionStatus[] {
  return attempt < MAX_ATTEMPTS ? ["passed", "resubmit"] : ["passed", "not_passed"];
}

/** Date (YYYY-MM-DD) each piece passed, when every one of `kinds` has; else null. */
export function passDates(subs: SubmissionLike[], kinds: CapstoneKind[]): Record<string, string> | null {
  const out: Record<string, string> = {};
  for (const kind of kinds) {
    const s = latestOf(subs, kind);
    if (s?.status !== "passed" || !s.reviewed_at) return null;
    out[kind] = s.reviewed_at.slice(0, 10);
  }
  return kinds.length ? out : null;
}

/** Seconds between a pushback question being shown and the answer arriving. */
export function answerSeconds(revealedAt: string | null, answeredAt: string | null): number | null {
  if (!revealedAt || !answeredAt) return null;
  return Math.round((new Date(answeredAt).getTime() - new Date(revealedAt).getTime()) / 1000);
}

/** Over prep + answer time, with a minute's grace for the upload. Shown to the assessor, never enforced. */
export function answeredLate(cfg: CapstoneConfig, seconds: number | null): boolean {
  if (!cfg.pushback || seconds == null) return false;
  return seconds > cfg.pushback.prepSeconds + cfg.pushback.answerSeconds + 60;
}
