import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { redirect } from "next/navigation";
import SettingsClient from "./settings-client";
import type { SettingsData } from "./settings-client";

export const metadata: Metadata = {
  title: "Settings | LMS Platform",
  description: "Manage your account preferences, language, and notification settings",
};

export default async function SettingsPage() {
  const supabase = await createClient();

  // Auth check
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  // Fetch user with organization
  const service = createServiceClient();
  const { data: dbUser } = await service
    .from("users")
    .select(`
      id,
      auth_id,
      email,
      first_name,
      last_name,
      avatar_url,
      role,
      organization_id,
      job_title,
      preferences,
      organizations (
        id,
        name
      )
    `)
    .eq("auth_id", user.id)
    .single();

  if (!dbUser) {
    redirect("/login");
  }

  const userData = dbUser as any;

  // Build initials
  const firstName = userData.first_name || "";
  const lastName = userData.last_name || "";
  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();

  // Extract preferences
  const preferences = userData.preferences || {};

  // Fetch platform_settings for defaults (optional fallback)
  const { data: platformSettings } = await service
    .from("platform_settings")
    .select("key, value")
    .in("key", ["default_language", "default_timezone", "default_theme", "default_date_format"]);

  const platformDefaults: Record<string, string> = {};
  (platformSettings || []).forEach((ps: any) => {
    platformDefaults[ps.key] = ps.value;
  });

  const settingsData: SettingsData = {
    userId: userData.id,
    firstName,
    lastName,
    initials,
    email: userData.email || user.email || "",
    jobTitle: userData.job_title || "No title",
    organizationName: userData.organizations?.name || "Unknown Department",
    bio: preferences.bio || "",
    language: preferences.language || platformDefaults.default_language || "en",
    timezone: preferences.timezone || platformDefaults.default_timezone || "America/Los_Angeles",
    theme: preferences.theme || platformDefaults.default_theme || "system",
    dateFormat: preferences.date_format || platformDefaults.default_date_format || "MM/DD/YYYY",
  };

  return <SettingsClient data={settingsData} />;
}
