import type { HelpManual, HelpRole } from "./types";
import { learnerManual } from "./learner";
import { managerManual } from "./manager";
import { instructorManual } from "./instructor";
import { adminManual } from "./admin";
import { superAdminManual } from "./super-admin";

export const helpManuals: HelpManual[] = [
  learnerManual,
  managerManual,
  instructorManual,
  adminManual,
  superAdminManual,
];

export function getManual(role: HelpRole): HelpManual {
  return helpManuals.find((m) => m.role === role) ?? learnerManual;
}

export function getChapter(role: HelpRole, slug: string) {
  const manual = getManual(role);
  for (const group of manual.groups) {
    const c = group.chapters.find((c) => c.slug === slug);
    if (c) return { manual, chapter: c, group };
  }
  return null;
}

export interface SearchableEntry {
  kind: "chapter" | "faq";
  role: HelpRole;
  chapterSlug: string;
  title: string;
  subtitle: string;
  body: string;
}

export type { HelpManual, HelpRole };
