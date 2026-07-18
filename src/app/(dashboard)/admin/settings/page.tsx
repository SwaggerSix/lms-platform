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
  companyName: "",
  timezone: "America/New_York",
  language: "en",
  dateFormat: "MM/DD/YYYY",
};

const defaultBranding = {
  primaryColor: "#91C53C",
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
  emailFooter: "",
  webhookUrl: "",
  selectedWebhookEvents: [],
};

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
    .select("id, role, organization_id")
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

  // API keys live in their own table (hashed secrets), scoped to the org.
  let apiKeyQuery = service
    .from("api_keys")
    .select("id, name, key_prefix, last_four, status, created_at, last_used_at")
    .order("created_at", { ascending: false });
  if (dbUser.organization_id) {
    apiKeyQuery = apiKeyQuery.eq("organization_id", dbUser.organization_id);
  }
  const { data: apiKeyRows } = await apiKeyQuery;
  const apiKeys: ApiKey[] = (apiKeyRows ?? []).map((row: any) => ({
    id: row.id,
    name: row.name,
    keyPreview: `${row.key_prefix}…${row.last_four}`,
    created: (row.created_at ?? "").split("T")[0] ?? "",
    lastUsed: row.last_used_at ? (row.last_used_at as string).split("T")[0] : "Never",
    status: row.status === "revoked" ? "Revoked" : "Active",
  }));

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
    registration: {
      // Secure default: invite-only until an admin opts into open/domain.
      mode: (["open", "domain", "closed"].includes(settingsMap["registration"]?.mode)
        ? settingsMap["registration"].mode
        : "closed") as "open" | "domain" | "closed",
      allowedDomains: Array.isArray(settingsMap["registration"]?.allowed_domains)
        ? settingsMap["registration"].allowed_domains
        : [],
    },
    apiKeys,
  };

  return <SettingsClient data={settingsData} />;
}
