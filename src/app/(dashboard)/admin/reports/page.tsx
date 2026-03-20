import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import ReportsClient from "./reports-client";
import type { ReportRow, RecentReport, ReportSummary } from "./reports-client";

export const metadata: Metadata = {
  title: "Reports | LMS Platform",
  description: "Generate and view platform-wide enrollment, completion, and compliance reports",
};

function formatTimeSpent(minutes: number | null): string {
  if (!minutes) return "0h 0m";
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0 && mins > 0) return `${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h`;
  return `${mins}m`;
}

function formatStatus(status: string | null): string {
  switch (status) {
    case "completed": return "Completed";
    case "in_progress": return "In Progress";
    case "overdue": return "Overdue";
    default: return "Not Started";
  }
}

export default async function ReportsPage() {
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
    .select("id, role")
    .eq("auth_id", user.id)
    .single();

  if (!dbUser) {
    redirect("/login");
  }

  if (!["admin", "manager"].includes(dbUser.role)) {
    redirect("/dashboard");
  }

  // Run all aggregate queries in parallel
  const [
    totalEnrollmentsResult,
    inProgressResult,
    completedResult,
    activeUsersResult,
    publishedCoursesResult,
    complianceReqResult,
    enrollmentRowsResult,
  ] = await Promise.all([
    // Total enrollments count
    service
      .from("enrollments")
      .select("*", { count: "exact", head: true }),

    // In-progress enrollments count
    service
      .from("enrollments")
      .select("*", { count: "exact", head: true })
      .eq("status", "in_progress"),

    // Completed enrollments count
    service
      .from("enrollments")
      .select("*", { count: "exact", head: true })
      .eq("status", "completed"),

    // Active users count
    service
      .from("users")
      .select("*", { count: "exact", head: true })
      .eq("status", "active"),

    // Published courses count
    service
      .from("courses")
      .select("*", { count: "exact", head: true })
      .eq("status", "published"),

    // Compliance requirements with enrollments for compliance rate
    service
      .from("compliance_requirements")
      .select("id, course_id")
      .limit(100),

    // Recent enrollments with user and course details for report table
    service
      .from("enrollments")
      .select("id, status, score, completed_at, time_spent, user:users(first_name, last_name, department), course:courses(title)")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  // Calculate compliance rate
  let complianceRate = 0;
  const complianceReqs = (complianceReqResult.data ?? []) as any[];
  if (complianceReqs.length > 0) {
    const courseIds = complianceReqs
      .map((r: any) => r.course_id)
      .filter(Boolean);

    if (courseIds.length > 0) {
      const [complianceTotal, complianceCompleted] = await Promise.all([
        service
          .from("enrollments")
          .select("*", { count: "exact", head: true })
          .in("course_id", courseIds),
        service
          .from("enrollments")
          .select("*", { count: "exact", head: true })
          .in("course_id", courseIds)
          .eq("status", "completed"),
      ]);

      const total = complianceTotal.count ?? 0;
      const completed = complianceCompleted.count ?? 0;
      complianceRate = total > 0 ? Math.round((completed / total) * 100) : 0;
    }
  }

  const summary: ReportSummary = {
    totalEnrollments: totalEnrollmentsResult.count ?? 0,
    inProgressCount: inProgressResult.count ?? 0,
    completedCount: completedResult.count ?? 0,
    activeUsersCount: activeUsersResult.count ?? 0,
    publishedCoursesCount: publishedCoursesResult.count ?? 0,
    complianceRate,
  };

  // Map enrollment rows to ReportRow format
  const reportData: ReportRow[] = ((enrollmentRowsResult.data ?? []) as any[]).map((row: any) => {
    const firstName = row.user?.first_name ?? "";
    const lastName = row.user?.last_name ?? "";
    const userName = `${firstName} ${lastName}`.trim() || "Unknown User";

    return {
      userName,
      department: row.user?.department ?? "N/A",
      course: row.course?.title ?? "Unknown Course",
      status: formatStatus(row.status),
      score: row.score ?? 0,
      completionDate: row.completed_at
        ? new Date(row.completed_at).toISOString().split("T")[0]
        : "-",
      timeSpent: formatTimeSpent(row.time_spent),
      certificate: row.status === "completed" ? "Yes" : "No",
    };
  });

  // Recent reports - these are static/placeholder since there's no reports table yet
  const recentReports: RecentReport[] = [
    { id: "1", name: "Q1 Completion Report", generatedDate: "2026-03-15", generatedBy: "Admin User", rowCount: summary.completedCount || 0 },
    { id: "2", name: "Compliance Status - March", generatedDate: "2026-03-14", generatedBy: "Admin User", rowCount: summary.totalEnrollments || 0 },
    { id: "3", name: "Active Users Summary", generatedDate: "2026-03-12", generatedBy: "Admin User", rowCount: summary.activeUsersCount || 0 },
    { id: "4", name: "Published Courses Overview", generatedDate: "2026-03-10", generatedBy: "Admin User", rowCount: summary.publishedCoursesCount || 0 },
    { id: "5", name: "In-Progress Enrollments", generatedDate: "2026-03-08", generatedBy: "Admin User", rowCount: summary.inProgressCount || 0 },
  ];

  return (
    <ReportsClient
      reportData={reportData}
      recentReports={recentReports}
      summary={summary}
    />
  );
}
