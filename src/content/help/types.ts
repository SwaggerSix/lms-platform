/**
 * Types for the role-based help manual / FAQ system.
 *
 * Content lives in src/content/help/<role>.ts as plain TypeScript objects.
 * Pages render this content through <ChapterRenderer> with a small
 * markdown-lite formatter (bold, italics, lists, links, code).
 */

export type HelpRole =
  | "learner"
  | "manager"
  | "instructor"
  | "admin"
  | "super-admin";

export interface HelpSection {
  /** Heading shown in the chapter body */
  heading: string;
  /** Lightweight markdown: paragraphs, **bold**, *italic*, `code`,
   *  bullet lines starting with `- `, numbered steps starting with `1. `,
   *  links like `[label](/href)`. Blank lines separate paragraphs. */
  body: string;
}

export interface HelpFaq {
  q: string;
  a: string;
}

export interface HelpRelated {
  label: string;
  /** Either a chapter slug within the same manual, or a full app href */
  chapter?: string;
  href?: string;
}

export interface HelpChapter {
  /** URL slug — kebab-case */
  slug: string;
  title: string;
  /** Short one- or two-sentence purpose statement */
  summary: string;
  /** Optional "who this chapter is for" line (role nuances) */
  whoItsFor?: string;
  /** App link the chapter is about — surfaced as a CTA */
  pageLink?: string;
  /** Ordered list of body sections */
  sections: HelpSection[];
  /** Frequently asked questions */
  faqs: HelpFaq[];
  /** Related chapters or pages */
  related?: HelpRelated[];
}

export interface HelpManualGroup {
  /** Group heading shown in the table of contents */
  heading: string;
  chapters: HelpChapter[];
}

export interface HelpManual {
  role: HelpRole;
  /** Display name, e.g. "Learner Manual" */
  title: string;
  /** Short intro shown on the manual's landing page */
  intro: string;
  groups: HelpManualGroup[];
}
