"use client";

import { useRouter } from "next/navigation";
import { cn } from "@/utils/cn";

export type ProfileTab = "overview" | "skills";

const TAB_ROUTES: Record<ProfileTab, string> = {
  overview: "/profile",
  skills: "/profile/skills",
};

const TABS: { key: ProfileTab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "skills", label: "Skills & Gaps" },
];

/**
 * Tab bar shared by the profile surfaces: the overview page and the skills
 * radar/gap analysis. Presents them as one profile with tabs (UX review
 * §2.9) while each keeps its own route and data loading.
 */
export default function ProfileTabs({ active }: { active: ProfileTab }) {
  const router = useRouter();

  return (
    <div
      role="group"
      aria-label="Profile section"
      className="flex w-fit items-center gap-1 rounded-lg bg-gray-100 p-1"
    >
      {TABS.map((tab) => (
        <button
          key={tab.key}
          onClick={() => {
            if (tab.key !== active) router.push(TAB_ROUTES[tab.key]);
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
