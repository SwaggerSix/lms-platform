"use client";

import { useRouter } from "next/navigation";
import { SegmentedControl } from "@/components/ui/segmented-control";

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

  const tabs: { value: CatalogSourceTab; label: string }[] = [
    { value: "internal", label: "Internal" },
    ...(showPartner ? [{ value: "partner" as const, label: "Partner" }] : []),
    ...(showStore ? [{ value: "store" as const, label: "Store" }] : []),
    ...(showForYou ? [{ value: "forYou" as const, label: "For You" }] : []),
  ];

  if (tabs.length < 2) return null;

  return (
    <SegmentedControl
      aria-label="Course source"
      value={active}
      options={tabs}
      onChange={(value) => {
        const tab = value as CatalogSourceTab;
        if (onSelect?.(tab)) return;
        router.push(TAB_ROUTES[tab]);
      }}
    />
  );
}
