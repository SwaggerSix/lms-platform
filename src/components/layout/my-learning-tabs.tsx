"use client";

import SectionTabs from "./section-tabs";

// The learner's record surfaces presented as one "My Learning" hub.
const TABS = [
  { label: "My Courses", href: "/learn/my-courses" },
  { label: "Transcript", href: "/learn/transcript" },
];

export default function MyLearningTabs() {
  return <SectionTabs tabs={TABS} ariaLabel="My learning sections" />;
}
