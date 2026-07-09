"use client";

import { useRouter } from "next/navigation";
import { SegmentedControl } from "@/components/ui/segmented-control";

export type ProfileTab = "overview" | "skills";

const TAB_ROUTES: Record<ProfileTab, string> = {
  overview: "/profile",
  skills: "/profile/skills",
};

const TABS = [
  { value: "overview", label: "Overview" },
  { value: "skills", label: "Skills & Gaps" },
];

/**
 * Tab bar shared by the profile surfaces: the overview page and the skills
 * radar/gap analysis. Presents them as one profile with tabs (UX review
 * §2.9) while each keeps its own route and data loading.
 */
export default function ProfileTabs({ active }: { active: ProfileTab }) {
  const router = useRouter();

  return (
    <SegmentedControl
      aria-label="Profile section"
      value={active}
      options={TABS}
      onChange={(value) => {
        if (value !== active) router.push(TAB_ROUTES[value as ProfileTab]);
      }}
    />
  );
}
