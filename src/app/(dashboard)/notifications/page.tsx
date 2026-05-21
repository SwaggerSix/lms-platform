import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import NotificationsClient, { type NotificationRow } from "./notifications-client";

export const metadata: Metadata = {
  title: "Notifications | LMS Platform",
  description: "All your in-app notifications",
};

export default async function NotificationsPage() {
  const supabase = await createClient();
  const { data: authUser } = await supabase.auth.getUser();
  if (!authUser.user) redirect("/login");

  const service = createServiceClient();
  const { data: profile } = await service
    .from("users")
    .select("id")
    .eq("auth_id", authUser.user.id)
    .single();
  if (!profile) redirect("/login");

  const { data } = await service
    .from("notifications")
    .select("id, type, title, body, link, is_read, channel, created_at")
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(200);

  const rows: NotificationRow[] = (data ?? []) as NotificationRow[];

  return <NotificationsClient initialNotifications={rows} userId={profile.id} />;
}
