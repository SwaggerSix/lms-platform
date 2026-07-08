"use client";

import { useRouter } from "next/navigation";
import { cn } from "@/utils/cn";

export type CatalogSourceTab = "internal" | "partner" | "store" | "forYou";

const TAB_ROUTES: Record<CatalogSourceTab, string> = {
  internal: "/learn/catalog",
  partner: "/learn/catalog?source=partner",
  store: "/learn/catalog?source=store",
  forYou: "/learn/recommendations",
};

/**
 * Source tab bar shared by the course-discovery surfaces: the catalog's
 * Internal/Partner/Store tabs and the personalized For You page. Tabs
 * navigate between routes by default; the catalog overrides in-page
 * switching via onSelect (return true to mark the tab handled).
 */
export default function CatalogSourceTabs({
  active,
  showPartner,
  showStore,
  showForYou,
  onSelect,
}: {
  active: CatalogSourceTab;
  showPartner: boolean;
  showStore: boolean;
  showForYou: boolean;
  onSelect?: (tab: CatalogSourceTab) => boolean;
}) {
  const router = useRouter();

  const tabs: { key: CatalogSourceTab; label: string }[] = [
    { key: "internal", label: "Internal" },
    ...(showPartner ? [{ key: "partner" as const, label: "Partner" }] : []),
    ...(showStore ? [{ key: "store" as const, label: "Store" }] : []),
    ...(showForYou ? [{ key: "forYou" as const, label: "For You" }] : []),
  ];

  if (tabs.length < 2) return null;

  return (
    <div
      role="group"
      aria-label="Course source"
      className="flex w-fit items-center gap-1 rounded-lg bg-gray-100 p-1"
    >
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => {
            if (onSelect?.(tab.key)) return;
            router.push(TAB_ROUTES[tab.key]);
          }}
          aria-pressed={active === tab.key}
          className={cn(
            "rounded-md px-4 py-2 text-sm font-medium transition-colors",
            active === tab.key
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
