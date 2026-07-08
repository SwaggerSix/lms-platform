"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/utils/cn";

export interface SectionTab {
  label: string;
  href: string;
}

/**
 * Horizontal tab bar linking sibling pages of a hub (e.g. Sessions,
 * Analytics & Reports). The tab matching the current route is highlighted;
 * matching is by longest href prefix so detail routes stay highlighted.
 */
export default function SectionTabs({
  tabs,
  ariaLabel,
}: {
  tabs: SectionTab[];
  ariaLabel: string;
}) {
  const pathname = usePathname();

  const activeHref = tabs.reduce((best, tab) => {
    const matches = pathname === tab.href || pathname.startsWith(tab.href + "/");
    return matches && tab.href.length > best.length ? tab.href : best;
  }, "");

  return (
    <nav aria-label={ariaLabel} className="mb-6 flex gap-1 overflow-x-auto border-b border-gray-200">
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          aria-current={activeHref === tab.href ? "page" : undefined}
          className={cn(
            "whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500",
            activeHref === tab.href
              ? "border-primary-600 text-primary-600"
              : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
