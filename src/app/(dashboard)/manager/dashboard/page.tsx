import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import ManagerDashboardClient, { type ManagerDashboardData } from "./manager-dashboard-client";
import { readRequiredFor, userMatchesRequiredFor } from "@/lib/courses/required-training";

export const metadata: Metadata = {
  title: "Team Dashboard | LMS Platform",
  description: "Overview of your team's training progress, overdue work, required-training compliance, and CPE.",
};

export default async function ManagerDashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const service = createServiceClient();
  const { data: dbUser } = await service
    .from("users")
    .select("id, role, first_name")
    .eq("auth_id", user.id)
    .single();
  if (!dbUser) redirect("/login");
  if (!["manager", "admin", "super_admin"].includes(dbUser.role)) {
    redirect("/dashboard");
  }

  const { data: directReports } = await service
    .from("users")
    .select("id, first_name, last_name, email, role, organization_id, hire_date, status")
    .eq("manager_id", dbUser.id);

  const reports = directReports ?? [];
  const reportIds = reports.map((r) => r.id);

  // No team — render empty state via the client.
  if (reportIds.length === 0) {
    const empty: ManagerDashboardData = {
      managerName: dbUser.first_name ?? "Manager",
      teamSize: 0,
      overdueCount: 0,
      dueThisWeekCount: 0,
      verifiedCpeLastYear: 0,
      requiredComplianceRate: 0,
      overdue: [],
      dueThisWeek: [],
      requiredCompliance: [],
      recertificationsDue: [],
      recentCompletions: [],
    };
    return <ManagerDashboardClient data={empty} />;
  }

  const [enrollmentsResult, coursesResult] = await Promise.all([
    service
      .from("enrollments")
      .select("id, user_id, course_id, status, completed_at, due_date, score")
      .in("user_id", reportIds),
    service
      .from("courses")
      .select("id, title, passing_score, metadata, status")
      .neq("status", "archived"),
  ]);

  const enrollments = (enrollmentsResult.data ?? []) as Array<{
    id: string;
    user_id: string;
    course_id: string;
    status: string;
    completed_at: string | null;
    due_date: string | null;
    score: number | null;
  }>;

  const courses = (coursesResult.data ?? []) as Array<{
    id: string;
    title: string;
    passing_score: number | null;
    metadata: Record<string, unknown> | null;
  }>;

  const courseById = new Map(courses.map((c) => [c.id, c]));
  const reportById = new Map(reports.map((r) => [r.id, r]));

  // Required-training compliance per report.
  const requiredByReport = new Map<string, { required: number; complete: number }>();
  for (const r of reports) {
    requiredByReport.set(r.id, { required: 0, complete: 0 });
  }
  const requiredCourseIds = new Set<string>();
  for (const c of courses) {
    const cfg = readRequiredFor(c.metadata);
    if (!cfg) continue;
    for (const r of reports) {
      if (userMatchesRequiredFor(cfg, { role: r.role ?? null, organization_id: r.organization_id ?? null })) {
        const bucket = requiredByReport.get(r.id)!;
        bucket.required += 1;
        requiredCourseIds.add(c.id);
      }
    }
  }

  // Count completed enrollments toward required compliance. For recurring
  // compliance courses, a stale completion (past frequency_months) does NOT
  // count — the learner needs to re-take the course.
  const courseFrequency = new Map<string, number>();
  for (const c of courses) {
    const cfg = readRequiredFor(c.metadata);
    if (cfg?.frequency_months) courseFrequency.set(c.id, cfg.frequency_months);
  }
  for (const e of enrollments) {
    if (e.status !== "completed") continue;
    if (!requiredCourseIds.has(e.course_id)) continue;
    const bucket = requiredByReport.get(e.user_id);
    if (!bucket) continue;
    const freq = courseFrequency.get(e.course_id);
    if (freq && e.completed_at) {
      const expiresAt = new Date(e.completed_at);
      expiresAt.setMonth(expiresAt.getMonth() + freq);
      if (expiresAt.getTime() < Date.now()) continue;
    }
    bucket.complete += 1;
  }

  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const yearAgo = now - 365 * dayMs;
  const weekFromNow = now + 7 * dayMs;

  // Overdue: open enrollments whose due_date is before now.
  // Due this week: open enrollments due in the next 7 days.
  const overdue: ManagerDashboardData["overdue"] = [];
  const dueThisWeek: ManagerDashboardData["dueThisWeek"] = [];
  for (const e of enrollments) {
    if (e.status === "completed" || !e.due_date) continue;
    const dueMs = new Date(e.due_date).getTime();
    if (!Number.isFinite(dueMs)) continue;
    const learner = reportById.get(e.user_id);
    const course = courseById.get(e.course_id);
    if (!learner || !course) continue;
    if (dueMs < now) {
      overdue.push({
        enrollmentId: e.id,
        learnerId: learner.id,
        learnerName: `${learner.first_name ?? ""} ${learner.last_name ?? ""}`.trim() || "Unknown",
        courseTitle: course.title,
        daysOverdue: Math.ceil((now - dueMs) / dayMs),
      });
    } else if (dueMs <= weekFromNow) {
      dueThisWeek.push({
        enrollmentId: e.id,
        learnerId: learner.id,
        learnerName: `${learner.first_name ?? ""} ${learner.last_name ?? ""}`.trim() || "Unknown",
        courseTitle: course.title,
        daysUntilDue: Math.ceil((dueMs - now) / dayMs),
      });
    }
  }
  overdue.sort((a, b) => b.daysOverdue - a.daysOverdue);
  dueThisWeek.sort((a, b) => a.daysUntilDue - b.daysUntilDue);

  // Verified CPE earned in the last 12 months.
  let verifiedCpe = 0;
  const cpeByLearner = new Map<string, number>();
  for (const e of enrollments) {
    if (e.status !== "completed" || !e.completed_at) continue;
    const completedMs = new Date(e.completed_at).getTime();
    if (!Number.isFinite(completedMs) || completedMs < yearAgo) continue;
    const course = courseById.get(e.course_id);
    const meta = (course?.metadata ?? {}) as Record<string, unknown>;
    if (!meta.nasba_cpe) continue;
    const passingScore = Number(course?.passing_score) || 0;
    if (passingScore > 0 && (e.score ?? 0) < passingScore) continue;
    const credits = Number(meta.cpe_credits) || 0;
    verifiedCpe += credits;
    cpeByLearner.set(e.user_id, (cpeByLearner.get(e.user_id) ?? 0) + credits);
  }

  // Required-training compliance rows (sorted: worst first).
  const requiredCompliance: ManagerDashboardData["requiredCompliance"] = reports.map((r) => {
    const bucket = requiredByReport.get(r.id)!;
    const percent = bucket.required === 0 ? 100 : Math.round((bucket.complete / bucket.required) * 100);
    return {
      learnerId: r.id,
      learnerName: `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim() || "Unknown",
      required: bucket.required,
      complete: bucket.complete,
      percent,
      verifiedCpe: cpeByLearner.get(r.id) ?? 0,
    };
  }).sort((a, b) => a.percent - b.percent);

  const teamRequired = requiredCompliance.reduce((sum, r) => sum + r.required, 0);
  const teamComplete = requiredCompliance.reduce((sum, r) => sum + r.complete, 0);
  const requiredComplianceRate = teamRequired === 0 ? 100 : Math.round((teamComplete / teamRequired) * 100);

  // Recertifications expiring or overdue: walk every completed enrollment for
  // a required-training course with a frequency_months window and surface
  // anything within ±30 days of expiry.
  const recertificationsDue: ManagerDashboardData["recertificationsDue"] = [];
  for (const e of enrollments) {
    if (e.status !== "completed" || !e.completed_at) continue;
    const freq = courseFrequency.get(e.course_id);
    if (!freq) continue;
    const expiresAt = new Date(e.completed_at);
    expiresAt.setMonth(expiresAt.getMonth() + freq);
    const daysUntilExpiry = Math.ceil((expiresAt.getTime() - now) / dayMs);
    if (daysUntilExpiry > 30) continue;
    const learner = reportById.get(e.user_id);
    const course = courseById.get(e.course_id);
    if (!learner || !course) continue;
    const required = readRequiredFor(course.metadata);
    recertificationsDue.push({
      learnerId: learner.id,
      learnerName: `${learner.first_name ?? ""} ${learner.last_name ?? ""}`.trim() || "Unknown",
      courseTitle: course.title,
      regulation: required?.regulation ?? null,
      daysUntilExpiry,
    });
  }
  // Dedup: keep the latest completion per (learner, course). The cron
  // re-enrolls on expiry so we may see multiple completions for the same
  // (user, course) pair; we only want the most recent one.
  const dedup = new Map<string, typeof recertificationsDue[number]>();
  for (const r of recertificationsDue) {
    const key = `${r.learnerId}_${r.courseTitle}`;
    const prev = dedup.get(key);
    if (!prev || r.daysUntilExpiry > prev.daysUntilExpiry) dedup.set(key, r);
  }
  const recertificationsDueFinal = Array.from(dedup.values()).sort(
    (a, b) => a.daysUntilExpiry - b.daysUntilExpiry
  );

  // Recent completions — last 10 across the team.
  const recentCompletions: ManagerDashboardData["recentCompletions"] = enrollments
    .filter((e) => e.status === "completed" && e.completed_at)
    .sort((a, b) => new Date(b.completed_at!).getTime() - new Date(a.completed_at!).getTime())
    .slice(0, 10)
    .map((e) => {
      const learner = reportById.get(e.user_id);
      const course = courseById.get(e.course_id);
      return {
        enrollmentId: e.id,
        learnerName: `${learner?.first_name ?? ""} ${learner?.last_name ?? ""}`.trim() || "Unknown",
        courseTitle: course?.title ?? "Unknown",
        completedAt: e.completed_at!,
      };
    });

  const data: ManagerDashboardData = {
    managerName: dbUser.first_name ?? "Manager",
    teamSize: reports.length,
    overdueCount: overdue.length,
    dueThisWeekCount: dueThisWeek.length,
    verifiedCpeLastYear: verifiedCpe,
    requiredComplianceRate,
    overdue: overdue.slice(0, 8),
    dueThisWeek: dueThisWeek.slice(0, 8),
    requiredCompliance,
    recertificationsDue: recertificationsDueFinal.slice(0, 12),
    recentCompletions,
  };

  return <ManagerDashboardClient data={data} />;
}
