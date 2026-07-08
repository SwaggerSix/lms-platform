import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { getManual, helpManuals } from "@/content/help";
import type { HelpRole } from "@/content/help/types";

interface PageProps {
  params: Promise<{ role: string }>;
}

const VALID_ROLES: HelpRole[] = ["learner", "manager", "instructor", "admin", "super-admin"];

function isValidRole(role: string): role is HelpRole {
  return (VALID_ROLES as string[]).includes(role);
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { role } = await params;
  if (!isValidRole(role)) return { title: "Help" };
  const manual = getManual(role);
  return {
    title: `${manual.title} | Help`,
    description: manual.intro,
  };
}

export function generateStaticParams() {
  return helpManuals.map((m) => ({ role: m.role }));
}

export default async function RoleManualPage({ params }: PageProps) {
  const { role } = await params;
  if (!isValidRole(role)) return notFound();
  const manual = getManual(role);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <Link href="/help" className="mb-6 inline-flex items-center gap-1 text-sm font-medium text-primary-600 hover:text-primary-700">
        <ArrowLeft className="h-4 w-4" />
        All manuals
      </Link>

      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">{manual.title}</h1>
        <p className="mt-2 text-base text-gray-600">{manual.intro}</p>
      </header>

      <div className="space-y-8">
        {manual.groups.map((group) => (
          <section key={group.heading}>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
              {group.heading}
            </h2>
            <div className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 bg-white">
              {group.chapters.map((c) => (
                <Link
                  key={c.slug}
                  href={`/help/${role}/${c.slug}`}
                  className="flex items-start justify-between gap-3 px-5 py-4 hover:bg-gray-50"
                >
                  <div className="min-w-0">
                    <h3 className="font-medium text-gray-900">{c.title}</h3>
                    <p className="mt-0.5 text-sm text-gray-600">{c.summary}</p>
                  </div>
                  <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-gray-400" />
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
