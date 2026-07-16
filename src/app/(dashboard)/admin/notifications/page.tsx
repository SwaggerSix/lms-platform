import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import NotificationsClient from "./notifications-client";
import type { Announcement, NotificationTemplate } from "./notifications-client";

export const metadata: Metadata = {
  title: "Notifications | LMS Platform",
  description: "Manage announcements, notification templates, and delivery settings",
};

const typeToStatus: Record<string, Announcement["status"]> = {
  announcement: "Sent",
  reminder: "Scheduled",
  enrollment: "Sent",
  completion: "Sent",
  certification: "Sent",
  mention: "Sent",
};

const channelToPriority: Record<string, Announcement["priority"]> = {
  push: "Urgent",
  email: "High",
  in_app: "Normal",
};

export default async function NotificationsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const service = createServiceClient();
  const { data: dbUser } = await service
    .from("users")
    .select("id, role, organization_id")
    .eq("auth_id", user.id)
    .single();

  if (!dbUser) {
    redirect("/login");
  }

  // Fetch all notifications with user joins (admin view)
  const { data: rows } = await service
    .from("notifications")
    .select("*, user:users(id, first_name, last_name, email, role)")
    .order("created_at", { ascending: false })
    .limit(200);

  const announcements: Announcement[] = (rows ?? []).map((row: any) => {
    const userName = row.user
      ? `${row.user.first_name ?? ""} ${row.user.last_name ?? ""}`.trim()
      : "Unknown";
    const userRole = row.user?.role ?? "learner";

    return {
      id: row.id,
      title: row.title ?? "",
      body: row.body ?? "",
      targetAudience: row.type === "announcement" ? "All Users" : userName,
      status: row.is_read
        ? "Sent"
        : typeToStatus[row.type] ?? "Draft",
      sentDate: row.created_at
        ? new Date(row.created_at).toISOString().split("T")[0]
        : null,
      scheduledDate: null,
      viewCount: row.is_read ? 1 : 0,
      priority: channelToPriority[row.channel] ?? "Normal",
    };
  });

  // Notification templates are stored in notification_templates. Show the org's
  // templates, falling back to the global defaults (organization_id NULL) when
  // the org hasn't customized any. If the table isn't present yet (migration
  // not applied), fall back to the historical hardcoded defaults so the page
  // still renders.
  const FALLBACK_TEMPLATES: NotificationTemplate[] = [
    { id: "enrollment_confirmation", name: "Enrollment Confirmation", description: "Sent when a user is enrolled in a new course", preview: "You have been enrolled in {course_name}. Start your learning journey today!" },
    { id: "due_date_reminder", name: "Due Date Reminder", description: "Reminder sent 3 days before a course due date", preview: "Reminder: {course_name} is due on {due_date}. You are {progress}% complete." },
    { id: "completion_congratulations", name: "Completion Congratulations", description: "Sent when a user completes a course", preview: "Congratulations! You have completed {course_name} with a score of {score}%." },
    { id: "certificate_issued", name: "Certificate Issued", description: "Sent when a certificate is generated", preview: "Your certificate for {course_name} is now available. Download it from your profile." },
    { id: "overdue_warning", name: "Overdue Warning", description: "Sent when a course passes its due date", preview: "Action required: {course_name} was due on {due_date}. Please complete it as soon as possible." },
  ];

  let templateRows: any[] | null = null;
  if (dbUser.organization_id) {
    const { data } = await service
      .from("notification_templates")
      .select("id, name, description, body")
      .eq("organization_id", dbUser.organization_id)
      .order("created_at", { ascending: true });
    if (data && data.length > 0) templateRows = data;
  }
  if (!templateRows) {
    const { data, error } = await service
      .from("notification_templates")
      .select("id, name, description, body")
      .is("organization_id", null)
      .order("created_at", { ascending: true });
    if (!error) templateRows = data ?? [];
  }

  const templates: NotificationTemplate[] =
    templateRows && templateRows.length > 0
      ? templateRows.map((t) => ({
          id: t.id,
          name: t.name,
          description: t.description ?? "",
          preview: t.body ?? "",
        }))
      : FALLBACK_TEMPLATES;

  return <NotificationsClient announcements={announcements} templates={templates} />;
}
