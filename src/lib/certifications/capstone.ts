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
 * - **The Art of Presentation** (2026-11-25): one capstone per version of the
 *   course (gothamCulture, Gotham Government Services), opening once the
 *   course's final exam is passed. Three pieces: a recorded presentation
 *   (MP4 or MOV, up to MAX_VIDEO_BYTES, sent by resumable upload) and two
 *   Word documents.
 *
 * Content comes from surveycraft docs/training/<course>/modules/*-M6/M10.
 * Pure rules and content live here; database work is in capstone-service.ts.
 */

export const CAPSTONE_KINDS = [
  "memo",
  "dig",
  "signal",
  "briefing",
  "practical",
  "presentation",
  "document_1",
  "document_2",
] as const;
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
  /** Narrower than the file kind allows, as MIME type → extension (e.g. Word only, or MP4 and MOV only). */
  types?: Record<string, string>;
  /** Largest file for this piece. Default MAX_FILE_BYTES. Over RESUMABLE_OVER_BYTES it goes by resumable upload. */
  maxBytes?: number;
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
  /** Files the learner needs for this piece, shown as buttons above the instructions. */
  downloads?: CapstoneDownload[];
}

export interface CapstoneDownload {
  label: string;
  href: string;
  /** e.g. "PDF, 8 pages" */
  detail: string;
}

// The case files inside the Mosaic certification packages (served by
// /scorm-content to any signed-in user; scorm-packages/live/<package>/media/).
const CASE_FILES = {
  northwind: {
    label: "Northwind file (MOS-100)",
    href: "/scorm-content/2a1c6b35-3be3-42ae-9609-6aa3b685fff5/media/northwind-file.pdf",
    detail: "PDF, 8 pages: Exhibits A to E",
  },
  dig: {
    label: "Northwind dig file (MOS-230)",
    href: "/scorm-content/723e4d42-6cbb-454a-b001-624460a7a30d/media/dig-case-file.pdf",
    detail: "PDF, 8 pages",
  },
  signal: {
    label: "Mosaic Signal case file (MOS-240)",
    href: "/scorm-content/0a9c7164-14a5-45bb-bea0-520096b716d6/media/signal-case-file.pdf",
    detail: "PDF, 3 pages: Exhibits S3, S3.8 and S4-final",
  },
  task1Template: {
    label: "Task 1 memo template (Word)",
    href: "/scorm-content/2a1c6b35-3be3-42ae-9609-6aa3b685fff5/media/mos100-task1-memo-template.docx",
    detail: "ready to fill in",
  },
  findingCard: {
    label: "Finding Card (MOS-100 job aid)",
    href: "/scorm-content/2a1c6b35-3be3-42ae-9609-6aa3b685fff5/media/job-aids/M8-47-the-finding-card.pdf",
    detail: "PDF, 1 page",
  },
  briefingTemplate: {
    label: "1-3-1 Briefing Template (MOS-100 job aid)",
    href: "/scorm-content/2a1c6b35-3be3-42ae-9609-6aa3b685fff5/media/job-aids/M9-29-the-1-3-1-briefing-template.pdf",
    detail: "PDF, 1 page",
  },
  pushbackPlaybook: {
    label: "Pushback Playbook (MOS-100 job aid)",
    href: "/scorm-content/2a1c6b35-3be3-42ae-9609-6aa3b685fff5/media/job-aids/M9-30-the-pushback-playbook.pdf",
    detail: "PDF, 1 page",
  },
  task3Template: {
    label: "Task 3 memo template (Word)",
    href: "/scorm-content/0a9c7164-14a5-45bb-bea0-520096b716d6/media/mos240-task3-memo-template.docx",
    detail: "ready to fill in",
  },
  coachingTemplate: {
    label: "practical template (Word)",
    href: "/scorm-content/488f5096-04d6-4501-bfce-76a70aabf4ba/media/mos210-practical-template.docx",
    detail: "Parts 1 and 2, ready to fill in",
  },
  rationaleTemplate: {
    label: "design rationale template (Word)",
    href: "/scorm-content/c8960c24-0110-46c6-97be-36f05e2da5f2/media/mos220-design-rationale-template.docx",
    detail: "ready to fill in",
  },
  digTemplate: {
    label: "Culture Dig Word template (MOS-230)",
    href: "/scorm-content/723e4d42-6cbb-454a-b001-624460a7a30d/media/culture-dig-template.docx",
    detail: "Parts A and B, ready to fill in",
  },
} satisfies Record<string, CapstoneDownload>;

export interface CapstoneConfig {
  title: string;
  intro: string;
  /** One line for the learner's My Certifications card. */
  summary: string;
  pieces: PieceConfig[];
  pushback: { count: number; prepSeconds: number; answerSeconds: number; bank: PushbackPrompt[] } | null;
  turnaround: string;
  /** Who the certificate names as issuer. Default "gothamCulture". */
  issuer?: string;
  /** Told to the learner when a resubmission doesn't pass either. Default: SECOND_FAIL. */
  secondFail?: string;
  /** False: not a credential the Mosaic partner portal tracks, so awards aren't sent there. */
  partnerPortal?: boolean;
  /** Award the certificate as soon as the last piece passes, without the assessor pressing Award. */
  autoAward?: boolean;
}

/** After a resubmission doesn't pass: what happens next, unless the capstone says otherwise. */
export const SECOND_FAIL = "Dr. Chris Cancialosi will be in touch to set up a call about next steps.";

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

export const CAPSTONE_BUCKET = "certification-submissions";
export const MAX_FILE_BYTES = 50 * 1024 * 1024;
/**
 * Largest recorded presentation (The Art of Presentation). Storage allows up
 * to 500 GB a file on this plan; 5 GB is a 15-minute 4K phone recording with
 * room to spare. To change it: this number, the bucket's file_size_limit
 * (migration 20261125120000) and Supabase's global file size limit, which
 * must be at least as large.
 */
export const MAX_VIDEO_BYTES = 5 * 1024 * 1024 * 1024;
/** Above this a file is sent in 6 MB chunks that survive a dropped connection (capstone-upload.ts). */
export const RESUMABLE_OVER_BYTES = MAX_FILE_BYTES;
export const MAX_ATTEMPTS = 2;

const WORD_TYPES = {
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/msword": "doc",
};

/**
 * The Art of Presentation capstone (course AOP-100), the same for both
 * versions of the course apart from who issues it and which package its
 * templates and rubric come from. The two documents are the ones the course
 * gives Word templates for: the session plan, and the self-review and action
 * plan. Passing all three pieces awards the certificate with no further step.
 */
function artOfPresentation(v: { issuer: string; packageId: string; tag: string; suffix: string }): CapstoneConfig {
  const file = (path: string) => `/scorm-content/${v.packageId}/${encodeURI(path)}`;
  const rubric: CapstoneDownload = {
    label: "marking rubric",
    href: file(`downloads/AOP-100-${v.tag}-rubric.pdf`),
    detail: "PDF",
  };
  return {
    title: "Capstone: The Art of Presentation",
    intro:
      "Hand in three pieces of work: your recorded presentation, your session plan, and your self-review and action plan. Only your assessors can see what you hand in. Each piece is marked Pass or Not yet, with written feedback. If a piece isn't there yet, you get one resubmission of that piece. Pass all three and your certificate is awarded straight away.",
    summary:
      "Hand in your recorded presentation, session plan, and self-review and action plan. It opens once you've passed the course's final exam.",
    issuer: v.issuer,
    partnerPortal: false,
    autoAward: true,
    secondFail: "Your assessor will be in touch about next steps.",
    pieces: [
      {
        kind: "presentation",
        label: "Presentation video",
        noun: "presentation video",
        title: "Recorded presentation",
        file: "video",
        types: { "video/mp4": "mp4", "video/quicktime": "mov" },
        maxBytes: MAX_VIDEO_BYTES,
        link: "none",
        downloads: [rubric],
        instructions: [
          "Upload your recording as an MP4 or MOV file, up to 5 GB.",
          "A large video can take a while to upload. Keep this page open until it says it's handed in; if your connection drops, the upload picks up where it left off.",
        ],
      },
      {
        kind: "document_1",
        label: "Session plan",
        noun: "session plan",
        title: "Session plan",
        file: "document",
        types: WORD_TYPES,
        link: "none",
        downloads: [
          {
            label: "session plan template (Word)",
            href: file(`templates/AOP-100 Session plan template${v.suffix}.docx`),
            detail: "ready to fill in",
          },
        ],
        instructions: [
          "Use the session plan template (download it above). Plan the same presentation you recorded, not a different one.",
          "Fill in every section. Your assessor reads the plan alongside your video, so the two should match: same audience, same purpose, same structure.",
          "Be specific about your audience and what you want them to do or decide afterwards. \"Inform the team\" isn't an outcome.",
          "Upload it as a Word document (.docx or .doc), up to 50 MB.",
        ],
      },
      {
        kind: "document_2",
        label: "Self-review and action plan",
        noun: "self-review and action plan",
        title: "Self-review and action plan",
        file: "document",
        types: WORD_TYPES,
        link: "none",
        downloads: [
          {
            label: "self-review and action plan template (Word)",
            href: file(`templates/AOP-100 Self-review and action plan template${v.suffix}.docx`),
            detail: "ready to fill in",
          },
          rubric,
        ],
        instructions: [
          "Watch your recording all the way through before you write anything.",
          "Use the template (download it above). Score yourself against the marking rubric honestly; your assessor is looking at how well you see your own work, not for a perfect score.",
          "Name what worked, what didn't, and what you'd change, with a moment from the video for each.",
          "Finish with your action plan: two or three specific things you'll do differently next time, and when.",
          "Upload it as a Word document (.docx or .doc), up to 50 MB.",
        ],
      },
    ],
    pushback: null,
    turnaround: "about 10 business days",
  };
}

export const CAPSTONES: Record<string, CapstoneConfig> = {
  "mosaic-practitioner": {
    title: "Capstone: Northwind Health",
    intro:
      "One client, three tools. Hand in four pieces of work on Northwind Health: the Culture Mosaic memo, the Culture Dig plan and synthesis, the Mosaic Signal memo, and your recorded board briefing on what Northwind knows by November 18. Dr. Chris Cancialosi scores each, usually within 10 business days. If a piece doesn't meet the bar yet, you'll get written feedback and one resubmission; if the resubmission doesn't either, he'll set up a call with you. Pass all four and you're Mosaic Practitioner Certified for five years.",
    summary: "Hand in the four pieces of your Northwind capstone. It opens once you've finished MOS-100, MOS-230 and MOS-240.",
    pieces: [
      {
        kind: "memo",
        label: "Culture Mosaic memo",
        noun: "interpretation memo",
        title: "Task 1: Culture Mosaic interpretation memo",
        file: "document",
        link: "none",
        downloads: [CASE_FILES.northwind, CASE_FILES.task1Template, CASE_FILES.findingCard],
        instructions: [
          "No more than two pages, to Dana Okafor (CEO) and Alex Moreau (CPO). The case evidence is the Northwind file (download it above): Exhibits A to E.",
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
        downloads: [CASE_FILES.dig, CASE_FILES.digTemplate],
        instructions: [
          "One Word or PDF document with Part A (program plan and fieldwork plan for Taylor Brooks's clinic dig), then Part B (the two-page synthesis memo for Alex Moreau). Start from the Word template (download it above).",
          "Before you hand in: Part A has all eight sections and two domain fieldwork plans; Part B has a headline, three findings, limits and recommendations.",
          "Nothing in either part names or points to an individual, and you haven't promised anything the dig can't deliver. Don't promise Taylor results for individual clinics, and don't report any site or group under 10 stories.",
          "Your evidence is the Northwind dig file (download it above).",
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
        downloads: [CASE_FILES.signal, CASE_FILES.task3Template],
        instructions: [
          "No more than two pages, to Alex Moreau. Your data is the Mosaic Signal case file (download it above): Exhibits S3, S3.8 and S4-final.",
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
        downloads: [CASE_FILES.northwind, CASE_FILES.briefingTemplate, CASE_FILES.pushbackPlaybook],
        instructions: [
          "Record a 10–12 minute briefing for Northwind's board and executive team, as you'd deliver it on November 18. Use only what Northwind has by then: the Culture Mosaic, the October progress check, the change-readiness stories and the Team Report. Keep Jordan's 360 out. Tell one story: what you learned, whether the work since March made a difference, and what Northwind should do next, including whether a Culture Dig or another Mosaic Signal study should come next, and why.",
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
        { speaker: "CFO", text: "142 stories out of 640 people. Isn't 'willing but not able' just a few loud voices?" },
        { speaker: "CEO", text: "You're recommending a Culture Dig. Why spend more? Don't we already know the answer?" },
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
        downloads: [CASE_FILES.coachingTemplate],
        title: "Practical task (Gate G3)",
        warning:
          "The practice site (practice.mosaiccoachingstudio.com) is wiped on the 1st of each month. Take your screenshots and hand in during the same month.",
        instructions: [
          "One PDF or Word file with Part 1 and Part 2.",
          "Part 1: the completed Engagement Set-up Record, with screenshots of Sam's engagement as you built it on the practice site, and your reason for each choice.",
          "Part 2: your first-session plan (no more than one page) and your privacy reflection (300–500 words).",
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
    intro: `Hand in your practical task here. The assessor marks the file you upload, your rationale and screenshots, and takes the survey from your link if it's still live. ${ASSESSOR}`,
    summary: "Hand in your practical survey build for marking. The course exam alone doesn't certify you.",
    pieces: [
      practical({
        downloads: [CASE_FILES.rationaleTemplate],
        title: "Practical task (Gate G3)",
        link: "required",
        linkLabel: "The survey's published link",
        requiredNote: "The survey's exact name in the Mosaic Practice Workspace",
        warning:
          "The practice workspace is wiped on the 1st of every month, your survey with it, so your file is the evidence the assessor marks. Take your screenshots and hand in before the month ends, and keep your own copy of the file. If you resubmit in a new month, rebuild the survey first.",
        instructions: [
          "The survey's published link and its exact name in the Mosaic Practice Workspace.",
          "One PDF or Word file with your one-page design rationale, followed by your screenshots (they don't count toward the page).",
          "Screenshots: the test rows on the Responses page, taken before you delete them; Preview of each logic path (someone who knows the charter, and someone who doesn't); and the survey's settings page showing Anonymous Responses, minimum group size, close date and response limit.",
          "Don't screenshot Analytics charts or a Compare Two Questions table from your test run: they leave test responses out, so they'll be empty.",
          "The client's plan closes the survey on September 18, 2026, which has passed. Set any future close date in the workspace, and give September 18 as the client's close date in your rationale.",
          "Don't distribute the survey. Describe your roster and link plan in the rationale instead.",
        ],
      }),
    ],
    pushback: null,
    turnaround: "about 10 business days",
  },

  // Package ids: the SCORM packages imported 2026-11-25 (course-content/scorm/<id>/).
  "art-of-presentation-gc": artOfPresentation({
    issuer: "gothamCulture",
    packageId: "db27cf49-aace-45a7-956c-60b8ad6c2bc9",
    tag: "gC",
    suffix: "",
  }),
  "art-of-presentation-ggs": artOfPresentation({
    issuer: "Gotham Government Services",
    packageId: "f806115b-114a-41c1-814e-1b7d01cab3d2",
    tag: "GGS",
    suffix: " (GGS)",
  }),
};


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

/** MIME type → extension this piece accepts. */
export function typesOf(piece: Pick<PieceConfig, "file" | "types">): Record<string, string> {
  return piece.types ?? ALLOWED_TYPES[piece.file];
}

export function maxBytesOf(piece: Pick<PieceConfig, "maxBytes">): number {
  return piece.maxBytes ?? MAX_FILE_BYTES;
}

/** "50 MB", "5 GB". */
export function sizeLabel(bytes: number): string {
  const gb = bytes / 1024 ** 3;
  if (gb >= 1) return `${Number.isInteger(gb) ? gb : gb.toFixed(1)} GB`;
  return `${Math.round(bytes / 1024 ** 2)} MB`;
}

/** "PDF or DOCX", "MP4 or MOV": the extensions a piece takes, for messages. */
export function typesLabel(types: Record<string, string>): string {
  const exts = [...new Set(Object.values(types))].map((e) => e.toUpperCase());
  return exts.length <= 1 ? (exts[0] ?? "") : `${exts.slice(0, -1).join(", ")} or ${exts[exts.length - 1]}`;
}

const EXT_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  doc: "application/msword",
  mp4: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
};

/**
 * The MIME type to upload a file as. Browsers leave `type` empty when the
 * computer has no program registered for the extension (a .docx without
 * Word, a .mov on Windows), so fall back to the file name.
 */
export function contentTypeFor(file: { type?: string; name?: string }): string {
  const given = (file.type || "").split(";")[0].trim().toLowerCase();
  if (given && given !== "application/octet-stream") return given;
  const ext = (file.name ?? "").split(".").pop()?.toLowerCase() ?? "";
  return EXT_TYPES[ext] ?? (given || "application/octet-stream");
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
