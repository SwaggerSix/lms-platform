import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { authorize } from "@/lib/auth/authorize";
import { createServiceClient } from "@/lib/supabase/service";
import TeamsIntegrationClient from "./teams-client";

export const metadata: Metadata = {
  title: "Microsoft Teams Integration | LMS Platform",
  description: "Configure Microsoft Teams integration for notifications, calendar sync, and more",
};

export default async function TeamsIntegrationPage() {
  const auth = await authorize("admin");
  if (!auth.authorized) {
    redirect("/dashboard");
  }

  // Fetch current Teams settings
  const service = createServiceClient();

  const [webhookResult, calendarResult] = await Promise.all([
    service
      .from("platform_settings")
      .select("value")
      .eq("key", "teams_webhook_url")
      .single(),
    service
      .from("platform_settings")
      .select("value")
      .eq("key", "teams_calendar_sync")
      .single(),
  ]);

  const webhookConfig = (webhookResult.data?.value as { webhook_url?: string }) || {};
  const calendarConfig = (calendarResult.data?.value as { enabled?: boolean }) || {};

  return (
    <TeamsIntegrationClient
      initialWebhookUrl={webhookConfig.webhook_url || ""}
      initialCalendarEnabled={calendarConfig.enabled || false}
    />
  );
}
