import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ReportsClient, {
  type TeamMember,
  type MonthlyActivity,
  type SkillTrend,
  type ReportsData,
} from "./reports-client";

export const metadata: Metadata = {
  title: "Reports | LMS Platform",
  description: "View team learning analytics, completion rates, and performance reports",
};

export default async function ReportsPage() {
  const supabase = await createClient();

  // Authenticate
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Look up the current user in the users table
  const { data: currentUser } = await supabase
    .from("users")
    .select("id, first_name, last_name")
    .eq("auth_id", user.id)
    .single();

  if (!currentUser) {
    redirect("/login");
  }

  // Fetch team members (users where manager_id = current user)
  const { data: teamUsers } = await supabase
    .from("users")
    .select("id, first_name, last_name")
    .eq("manager_id", currentUser.id);

  const members = teamUsers ?? [];
  const memberIds = members.map((u: any) => u.id);

  // Fetch all enrollments for team members
  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("user_id, status, score, due_date, completed_at, enrolled_at, time_spent")
    .in("user_id", memberIds.length > 0 ? memberIds : ["__none__"]);

  const allEnrollments = enrollments ?? [];

  // Build per-member stats
  const now = new Date();
  const teamMembers: TeamMember[] = members.map((u: any) => {
    const userEnrollments = allEnrollments.filter((e: any) => e.user_id === u.id);
    const assigned = userEnrollments.length;
    const completed = userEnrollments.filter((e: any) => e.status === "completed").length;
    const inProgress = userEnrollments.filter(
      (e: any) => e.status === "in_progress" || e.status === "enrolled"
    ).length;
    const overdue = userEnrollments.filter(
      (e: any) =>
        e.due_date &&
        new Date(e.due_date) < now &&
        e.status !== "completed"
    ).length;

    const scores = userEnrollments
      .filter((e: any) => e.score != null)
      .map((e: any) => Number(e.score));
    const avgScore = scores.length > 0
      ? Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length)
      : 0;

    const completionRate = assigned > 0 ? Math.round((completed / assigned) * 100) : 0;

    const firstName = u.first_name ?? "";
    const lastName = u.last_name ?? "";
    const initials = (firstName.charAt(0) + lastName.charAt(0)).toUpperCase() || "??";

    return {
      name: `${firstName} ${lastName}`.trim() || "Unknown",
      initials,
      assigned,
      completed,
      inProgress,
      overdue,
      avgScore,
      completionRate,
    };
  });

  // Quick stats
  const completedThisMonth = allEnrollments.filter((e: any) => {
    if (e.status !== "completed" || !e.completed_at) return false;
    const d = new Date(e.completed_at);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  // Average completion time (days between enrolled_at and completed_at)
  const completionTimes = allEnrollments
    .filter((e: any) => e.status === "completed" && e.completed_at && e.enrolled_at)
    .map((e: any) => {
      const start = new Date(e.enrolled_at).getTime();
      const end = new Date(e.completed_at).getTime();
      return (end - start) / (1000 * 60 * 60 * 24);
    });
  const avgCompletionTime =
    completionTimes.length > 0
      ? `${(completionTimes.reduce((a, b) => a + b, 0) / completionTimes.length).toFixed(1)} days`
      : "N/A";

  // Top performer: member with highest completion rate (min 1 assigned)
  const eligibleMembers = teamMembers.filter((m) => m.assigned > 0);
  const topPerformer =
    eligibleMembers.length > 0
      ? [...eligibleMembers].sort((a, b) => b.completionRate - a.completionRate)[0].name
      : "N/A";

  // At-risk learners: members with any overdue enrollment
  const atRiskLearners = teamMembers.filter((m) => m.overdue > 0).length;

  // Monthly activity: aggregate completions per month over last 6 months
  const monthlyActivity: MonthlyActivity[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthName = d.toLocaleString("en-US", { month: "short" });
    const monthEnrollments = allEnrollments.filter((e: any) => {
      if (e.status !== "completed" || !e.completed_at) return false;
      const cd = new Date(e.completed_at);
      return cd.getMonth() === d.getMonth() && cd.getFullYear() === d.getFullYear();
    });
    // Estimate hours from time_spent (stored in seconds)
    const totalSeconds = allEnrollments
      .filter((e: any) => {
        if (!e.completed_at && !e.enrolled_at) return false;
        const refDate = e.completed_at ? new Date(e.completed_at) : new Date(e.enrolled_at);
        return refDate.getMonth() === d.getMonth() && refDate.getFullYear() === d.getFullYear();
      })
      .reduce((sum: number, e: any) => sum + (e.time_spent ?? 0), 0);
    const hours = Math.round(totalSeconds / 3600);

    monthlyActivity.push({
      month: monthName,
      hours,
      completions: monthEnrollments.length,
    });
  }

  // Skill trends: static data (no skills table in schema)
  const skillTrends: SkillTrend[] = [
    { skill: "React", prev: 2.5, current: 3.0, target: 3.5 },
    { skill: "TypeScript", prev: 2.2, current: 2.9, target: 3.0 },
    { skill: "Python", prev: 2.8, current: 3.0, target: 3.0 },
    { skill: "Cloud/AWS", prev: 2.0, current: 2.8, target: 3.5 },
    { skill: "Data Analysis", prev: 2.6, current: 3.1, target: 3.0 },
    { skill: "Leadership", prev: 2.0, current: 2.5, target: 3.0 },
  ];

  const data: ReportsData = {
    teamMembers,
    monthlyActivity,
    skillTrends,
    completedThisMonth,
    avgCompletionTime,
    topPerformer,
    atRiskLearners,
  };

  return <ReportsClient data={data} />;
}
