"use client";

import SectionTabs from "./section-tabs";
import { useAuth } from "@/components/providers/auth-provider";

// The reporting/analytics surfaces presented as one "Analytics & Reports" hub.
const TABS = [
  { label: "Overview", href: "/admin/dashboard" },
  { label: "Reports", href: "/admin/reports" },
  { label: "Scheduled Reports", href: "/admin/scheduled-reports" },
  { label: "Evaluation Insights", href: "/admin/evaluations/insights" },
];

const SUPER_ADMIN_TABS = [
  { label: "At-Risk Learners", href: "/admin/analytics/predictive" },
];

export default function AdminAnalyticsTabs() {
  const { user } = useAuth();
  const tabs =
    user?.role === "super_admin" ? [...TABS, ...SUPER_ADMIN_TABS] : TABS;
  return <SectionTabs tabs={tabs} ariaLabel="Analytics and reports sections" />;
}
