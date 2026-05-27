import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { redirect } from "next/navigation";
import ManagerNudgesClient from "./manager-nudges-client";

export const metadata: Metadata = {
  title: "Team Nudges | LMS Platform",
  description: "Assign and track daily MicroActions for your team",
};

export default async function ManagerNudgesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const service = createServiceClient();
  const { data: dbUser } = await service
    .from("users")
    .select("id, role, organization_id")
    .eq("auth_id", user.id)
    .single();
  if (!dbUser) redirect("/login");

  const [teamRes, assignmentsRes, actionsRes] = await Promise.all([
    service
      .from("users")
      .select("id, first_name, last_name, email")
      .eq("manager_id", dbUser.id)
      .eq("status", "active"),
    service
      .from("nudge_assignments")
      .select("*, nudge_actions(title, description, estimated_minutes)")
      .eq("assigned_by", dbUser.id)
      .order("created_at", { ascending: false }),
    service
      .from("nudge_actions")
      .select("*")
      .eq("is_active", true)
      .order("category", { ascending: true })
      .order("title", { ascending: true }),
  ]);

  return (
    <ManagerNudgesClient
      teamMembers={(teamRes.data ?? []) as never}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      initialAssignments={(assignmentsRes.data ?? []) as any}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      actions={(actionsRes.data ?? []) as any}
    />
  );
}
