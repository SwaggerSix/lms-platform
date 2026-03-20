import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import SettingsClient, { type SettingsData, type ApiKey, type NotificationType, type FeatureToggle } from "./settings-client";

export const metadata: Metadata = {
  title: "Settings | LMS Platform",
  description: "Configure platform settings, branding, features, and integrations",
};

// Fallback defaults when database rows don't exist yet
const defaultGeneral = {
  companyName: "Acme Corporation",
  timezone: "America/New_York",
  language: "en",
  dateFormat: "MM/DD/YYYY",
};

const defaultBranding = {
  primaryColor: "#4f46e5",
  accentColor: "#06b6d4",
};

const defaultFeatures: FeatureToggle[] = [
  { id: "1", name: "Gamification", description: "Enable points, badges, and leaderboards", enabled: true },
  { id: "2", name: "Social Learning", description: "Enable discussion forums and peer interaction", enabled: true },
  { id: "3", name: "Skills Tracking", description: "Enable skills engine and competency frameworks", enabled: true },
  { id: "4", name: "Self-Registration", description: "Allow users to create their own accounts", enabled: false },
  { id: "5", name: "Course Ratings", description: "Allow learners to rate and review courses", enabled: true },
  { id: "6", name: "Learning Paths", description: "Enable learning path feature", enabled: true },
  { id: "evaluations", name: "Evaluations", description: "Enable post-training evaluation surveys (Kirkpatrick L1–L4)", enabled: true },
];

const defaultNotifications = {
  types: [
    { id: "1", name: "Enrollment", description: "When a user is enrolled in a course", enabled: true },
    { id: "2", name: "Due Date Reminder", description: "Reminder before course due date", enabled: true },
    { id: "3", name: "Completion", description: "When a user completes a course", enabled: true },
    { id: "4", name: "Certification Expiry", description: "When a certification is about to expire", enabled: true },
    { id: "5", name: "Discussion Reply", description: "When someone replies to a discussion post", enabled: false },
  ] as NotificationType[],
  emailFooter: "This email was sent by Acme Corporation LMS. If you have questions, contact your administrator.",
  webhookUrl: "https://api.acme.com/webhooks/lms",
  selectedWebhookEvents: ["course.completed", "enrollment.created"],
};

const defaultApiKeys: ApiKey[] = [
  { id: "1", name: "Production API", keyPreview: "sk-prod-****-****-7f3a", created: "2026-01-15", lastUsed: "2026-03-16", status: "Active" },
  { id: "2", name: "Staging API", keyPreview: "sk-stg-****-****-2b9c", created: "2026-02-01", lastUsed: "2026-03-14", status: "Active" },
  { id: "3", name: "Legacy Integration", keyPreview: "sk-leg-****-****-8d1e", created: "2025-08-20", lastUsed: "2025-12-01", status: "Revoked" },
];

export default async function SettingsPage() {
  const supabase = await createClient();

  // Auth check
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  // Verify user exists in users table
  const service = createServiceClient();
  const { data: dbUser } = await service
    .from("users")
    .select("id, role")
    .eq("auth_id", user.id)
    .single();

  if (!dbUser) {
    redirect("/login");
  }

  if (dbUser.role !== "admin" && dbUser.role !== "super_admin") {
    redirect("/dashboard");
  }

  // Fetch all platform_settings rows
  const { data: settingsRows } = await service
    .from("platform_settings")
    .select("key, value");

  // Build a lookup map from the rows
  const settingsMap: Record<string, any> = {};
  for (const row of (settingsRows ?? []) as any) {
    settingsMap[row.key] = row.value;
  }

  // Merge database values with defaults
  const settingsData: SettingsData = {
    general: {
      ...defaultGeneral,
      ...(settingsMap["general"] ?? {}),
    },
    branding: {
      ...defaultBranding,
      ...(settingsMap["branding"] ?? {}),
    },
    features: Array.isArray(settingsMap["features"]) ? settingsMap["features"] as FeatureToggle[] : defaultFeatures,
    notifications: {
      ...defaultNotifications,
      ...(settingsMap["notifications"] ?? {}),
    },
    apiKeys: (settingsMap["api_keys"] as ApiKey[] | undefined) ?? defaultApiKeys,
  };

  return <SettingsClient data={settingsData} />;
}
