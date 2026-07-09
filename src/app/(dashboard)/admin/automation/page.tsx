import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { redirect } from "next/navigation";
import AutomationClient from "./automation-client";

export const metadata: Metadata = {
  title: "Automation | LMS Platform",
  description: "Configure enrollment automation rules and triggers",
};

export default async function AutomationPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const service = createServiceClient();
  const { data: dbUser } = await service
    .from("users")
    .select("id, role")
    .eq("auth_id", user.id)
    .single();

  if (!dbUser || dbUser.role !== "admin" && dbUser.role !== "super_admin") {
    redirect("/dashboard");
  }

  // Fetch all rules. Cap the fetch for performance (UX review §1.5); the client
  // surfaces a "showing first N of M" notice when the total exceeds the cap.
  const LIST_CAP = 500;
  const { data: rules, count: rulesCount } = await service
    .from("enrollment_rules")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .limit(LIST_CAP);

  // Fetch courses for the action builder
  const { data: courses } = await service
    .from("courses")
    .select("id, title")
    .eq("status", "published")
    .order("title", { ascending: true });

  // Fetch learning paths for the action builder
  const { data: paths } = await service
    .from("paths")
    .select("id, title")
    .eq("status", "published")
    .order("title", { ascending: true });

  // Fetch badges for the action builder
  const { data: badges } = await service
    .from("badges")
    .select("id, name")
    .order("name", { ascending: true });

  // Fetch organizations for the condition builder
  const { data: organizations } = await service
    .from("organizations")
    .select("id, name")
    .order("name", { ascending: true });

  return (
    <AutomationClient
      initialRules={rules ?? []}
      totalRules={rulesCount ?? (rules ?? []).length}
      courses={courses ?? []}
      paths={paths ?? []}
      badges={badges ?? []}
      organizations={organizations ?? []}
    />
  );
}
