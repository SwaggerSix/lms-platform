import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import TeamClient, { type TeamMember } from "./team-client";

export const metadata: Metadata = {
  title: "Team | LMS Platform",
  description: "Monitor your team members' learning progress and activity",
};

export default async function TeamPage() {
  const supabase = await createClient();

  // Get the current user
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const service = createServiceClient();
  const { data: dbUser } = await service
    .from("users")
    .select("id, role")
    .eq("auth_id", user.id)
    .single();
  if (!dbUser) redirect("/login");

  if (!["admin", "manager"].includes(dbUser.role)) {
    redirect("/dashboard");
  }

  // Fetch users managed by the current user
  const { data: users } = await service
    .from("users")
    .select("*, organization:organizations(name)")
    .eq("manager_id", dbUser.id)
    .order("created_at", { ascending: false });

  const userIds = (users ?? []).map((u: any) => u.id);

  // Fetch enrollment counts for all these users
  const { data: enrollments } = await service
    .from("enrollments")
    .select("user_id, status")
    .in("user_id", userIds.length > 0 ? userIds : ["__none__"]);

  // Aggregate enrollments by user_id
  const enrollmentMap: Record<
    string,
    { inProgress: number; completed: number }
  > = {};
  for (const enrollment of enrollments ?? []) {
    if (!enrollmentMap[enrollment.user_id]) {
      enrollmentMap[enrollment.user_id] = { inProgress: 0, completed: 0 };
    }
    if (enrollment.status === "in_progress") {
      enrollmentMap[enrollment.user_id].inProgress += 1;
    } else if (enrollment.status === "completed") {
      enrollmentMap[enrollment.user_id].completed += 1;
    }
  }

  // Map users to TeamMember interface
  const members: TeamMember[] = (users ?? []).map((u: any) => {
    const counts = enrollmentMap[u.id] ?? { inProgress: 0, completed: 0 };
    const total = counts.inProgress + counts.completed;
    const overallProgress =
      total > 0 ? Math.round((counts.completed / total) * 100) : 0;

    const firstName = u.first_name ?? "";
    const lastName = u.last_name ?? "";
    const avatar =
      (firstName.charAt(0) + lastName.charAt(0)).toUpperCase() || "??";

    let status: "active" | "inactive" | "on-leave" = "active";
    if (u.status === "inactive") {
      status = "inactive";
    } else if (u.status === "suspended") {
      status = "on-leave";
    }

    return {
      id: u.id,
      firstName,
      lastName,
      email: u.email ?? "",
      jobTitle: u.job_title ?? "Employee",
      department: u.organization?.name ?? "General",
      avatar,
      coursesInProgress: counts.inProgress,
      coursesCompleted: counts.completed,
      isCompliant: total > 0 ? overallProgress >= 80 : false,
      overallProgress,
      lastActive: u.updated_at ?? u.created_at ?? "",
      status,
    };
  });

  return <TeamClient members={members} />;
}
