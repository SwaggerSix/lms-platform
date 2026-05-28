import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getChapter, helpManuals } from "@/content/help";
import type { HelpRole } from "@/content/help/types";
import { ChapterRenderer } from "@/components/help/chapter-renderer";

interface PageProps {
  params: Promise<{ role: string; chapter: string }>;
}

const VALID_ROLES: HelpRole[] = ["learner", "manager", "instructor", "admin", "super-admin"];

function isValidRole(role: string): role is HelpRole {
  return (VALID_ROLES as string[]).includes(role);
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { role, chapter } = await params;
  if (!isValidRole(role)) return { title: "Help" };
  const found = getChapter(role, chapter);
  if (!found) return { title: "Help" };
  return {
    title: `${found.chapter.title} | ${found.manual.title}`,
    description: found.chapter.summary,
  };
}

export function generateStaticParams() {
  const out: { role: string; chapter: string }[] = [];
  for (const m of helpManuals) {
    for (const g of m.groups) {
      for (const c of g.chapters) {
        out.push({ role: m.role, chapter: c.slug });
      }
    }
  }
  return out;
}

export default async function ChapterPage({ params }: PageProps) {
  const { role, chapter } = await params;
  if (!isValidRole(role)) return notFound();
  const found = getChapter(role, chapter);
  if (!found) return notFound();
  return <ChapterRenderer role={role} chapter={found.chapter} />;
}
