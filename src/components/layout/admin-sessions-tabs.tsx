"use client";

import SectionTabs from "./section-tabs";

// The four instructor-led-session surfaces presented as one "Sessions" hub.
const TABS = [
  { label: "Webinars & Events", href: "/admin/ilt-sessions" },
  { label: "Classes", href: "/admin/classes" },
  { label: "Session Log", href: "/admin/training-events" },
  { label: "Shared Webinars", href: "/admin/shared-webinars" },
];

export default function AdminSessionsTabs() {
  return <SectionTabs tabs={TABS} ariaLabel="Sessions sections" />;
}
