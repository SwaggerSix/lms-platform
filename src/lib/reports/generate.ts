import { createServiceClient } from "@/lib/supabase/service";

export const VALID_REPORT_TYPES = [
  "completion",
  "compliance",
  "skills_gap",
  "engagement",
  "learner_progress",
  "course_effectiveness",
] as const;

export type ReportType = (typeof VALID_REPORT_TYPES)[number];

export interface ReportFilters {
  date_from?: string;
  date_to?: string;
  department?: string;
}

export function rowsToCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(","),
    ...rows.map((row) =>
      headers
        .map((h) => {
          const val = row[h];
          const str = val === null || val === undefined ? "" : String(val);
          if (str.includes(",") || str.includes('"') || str.includes("\n")) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        })
        .join(",")
    ),
  ];
  return lines.join("\n");
}

async function generateCompletionReport(
  service: ReturnType<typeof createServiceClient>,
  filters: ReportFilters
) {
  let query = service
    .from("enrollments")
    .select(
      "id, status, score, completed_at, time_spent, enrolled_at, user:users!enrollments_user_id_fkey(first_name, last_name, email, organization:organizations(name)), course:courses(title)"
    )
    .order("completed_at", { ascending: false })
    .limit(500);

  if (filters.date_from) {
    query = query.gte("enrolled_at", filters.date_from);
  }
  if (filters.date_to) {
    query = query.lte("enrolled_at", filters.date_to);
  }
  if (filters.department) {
    query = query.eq("user.organization_id", filters.department);
  }

  const { data, error } = await query;
  if (error) throw error;

  return ((data ?? []) as any[]).map((row: any) => ({
    user_name: `${row.user?.first_name ?? ""} ${row.user?.last_name ?? ""}`.trim() || "Unknown",
    email: row.user?.email ?? "",
    department: row.user?.organization?.name ?? "N/A",
    course_title: row.course?.title ?? "Unknown",
    status: row.status,
    score: row.score,
    enrolled_at: row.enrolled_at,
    completed_at: row.completed_at,
    time_spent: row.time_spent,
  }));
}

async function generateComplianceReport(
  service: ReturnType<typeof createServiceClient>
) {
  const { data: requirements, error } = await service
    .from("compliance_requirements")
    .select("id, name, frequency_months, course_id, course:courses(title)");

  if (error) throw error;

  const rows = [];
  for (const req of (requirements ?? []) as any[]) {
    if (!req.course_id) {
      rows.push({
        requirement_name: req.name,
        course_title: "N/A",
        total_enrolled: 0,
        completed_count: 0,
        compliance_rate: 0,
        frequency_months: req.frequency_months ?? null,
      });
      continue;
    }

    const [totalResult, completedResult] = await Promise.all([
      service
        .from("enrollments")
        .select("*", { count: "exact", head: true })
        .eq("course_id", req.course_id),
      service
        .from("enrollments")
        .select("*", { count: "exact", head: true })
        .eq("course_id", req.course_id)
        .eq("status", "completed"),
    ]);

    const totalEnrolled = totalResult.count ?? 0;
    const completedCount = completedResult.count ?? 0;
    const complianceRate =
      totalEnrolled > 0
        ? Math.round((completedCount / totalEnrolled) * 100)
        : 0;

    rows.push({
      requirement_name: req.name,
      course_title: req.course?.title ?? "N/A",
      total_enrolled: totalEnrolled,
      completed_count: completedCount,
      compliance_rate: complianceRate,
      frequency_months: req.frequency_months ?? null,
    });
  }

  return rows;
}

async function generateSkillsGapReport(
  service: ReturnType<typeof createServiceClient>,
  filters: ReportFilters
) {
  let query = service
    .from("user_skills")
    .select(
      "proficiency_level, source, assessed_at, user:users(first_name, last_name, organization:organizations(name)), skill:skills(name, category)"
    )
    .order("skill(category)")
    .order("skill(name)");

  if (filters.department) {
    query = query.eq("user.organization_id", filters.department);
  }

  const { data, error } = await query;
  if (error) throw error;

  return ((data ?? []) as any[]).map((row: any) => ({
    user_name: `${row.user?.first_name ?? ""} ${row.user?.last_name ?? ""}`.trim() || "Unknown",
    department: row.user?.organization?.name ?? "N/A",
    skill_name: row.skill?.name ?? "Unknown",
    category: row.skill?.category ?? "Uncategorized",
    proficiency_level: row.proficiency_level,
    source: row.source,
    assessed_at: row.assessed_at,
  }));
}

async function generateEngagementReport(
  service: ReturnType<typeof createServiceClient>,
  filters: ReportFilters
) {
  let query = service
    .from("enrollments")
    .select("course_id, status, score, time_spent, enrolled_at, course:courses(title)");

  if (filters.date_from) {
    query = query.gte("enrolled_at", filters.date_from);
  }
  if (filters.date_to) {
    query = query.lte("enrolled_at", filters.date_to);
  }

  const { data, error } = await query;
  if (error) throw error;

  const enrollments = (data ?? []) as any[];
  const courseMap = new Map<
    string,
    {
      course_title: string;
      enrollment_count: number;
      completion_count: number;
      total_score: number;
      scored_count: number;
      total_time_spent: number;
    }
  >();

  for (const e of enrollments) {
    const key = e.course_id;
    if (!courseMap.has(key)) {
      courseMap.set(key, {
        course_title: e.course?.title ?? "Unknown",
        enrollment_count: 0,
        completion_count: 0,
        total_score: 0,
        scored_count: 0,
        total_time_spent: 0,
      });
    }
    const entry = courseMap.get(key)!;
    entry.enrollment_count++;
    entry.total_time_spent += e.time_spent ?? 0;
    if (e.status === "completed") {
      entry.completion_count++;
      if (e.score !== null) {
        entry.total_score += e.score;
        entry.scored_count++;
      }
    }
  }

  return Array.from(courseMap.values()).map((entry) => ({
    course_title: entry.course_title,
    enrollment_count: entry.enrollment_count,
    completion_count: entry.completion_count,
    avg_score:
      entry.scored_count > 0
        ? Math.round(entry.total_score / entry.scored_count)
        : null,
    avg_time_spent:
      entry.enrollment_count > 0
        ? Math.round(entry.total_time_spent / entry.enrollment_count)
        : 0,
  }));
}

async function generateLearnerProgressReport(
  service: ReturnType<typeof createServiceClient>,
  filters: ReportFilters
) {
  let userQuery = service
    .from("users")
    .select("id, first_name, last_name, email, organization:organizations(name)")
    .eq("status", "active");

  if (filters.department) {
    userQuery = userQuery.eq("organization_id", filters.department);
  }

  const { data: users, error: usersError } = await userQuery;
  if (usersError) throw usersError;

  const rows = [];
  for (const user of (users ?? []) as any[]) {
    const { data: enrollments, error: enrollError } = await service
      .from("enrollments")
      .select("status, score, time_spent")
      .eq("user_id", user.id);

    if (enrollError) throw enrollError;

    const allEnrollments = (enrollments ?? []) as any[];
    const coursesAssigned = allEnrollments.length;
    const coursesCompleted = allEnrollments.filter(
      (e: any) => e.status === "completed"
    ).length;
    const completedWithScore = allEnrollments.filter(
      (e: any) => e.status === "completed" && e.score !== null
    );
    const avgScore =
      completedWithScore.length > 0
        ? Math.round(
            completedWithScore.reduce(
              (sum: number, e: any) => sum + e.score,
              0
            ) / completedWithScore.length
          )
        : null;
    const totalMinutes = allEnrollments.reduce(
      (sum: number, e: any) => sum + (e.time_spent ?? 0),
      0
    );

    rows.push({
      user_name: `${user.first_name} ${user.last_name}`.trim(),
      email: user.email,
      department: user.organization?.name ?? "N/A",
      courses_assigned: coursesAssigned,
      courses_completed: coursesCompleted,
      completion_rate:
        coursesAssigned > 0
          ? Math.round((coursesCompleted / coursesAssigned) * 100)
          : 0,
      avg_score: avgScore,
      total_hours: Math.round((totalMinutes / 60) * 10) / 10,
    });
  }

  return rows;
}

async function generateCourseEffectivenessReport(
  service: ReturnType<typeof createServiceClient>
) {
  const { data: courses, error: coursesError } = await service
    .from("courses")
    .select("id, title")
    .eq("status", "published");

  if (coursesError) throw coursesError;

  const rows = [];
  for (const course of (courses ?? []) as any[]) {
    const { data: enrollments, error: enrollError } = await service
      .from("enrollments")
      .select("status, score, time_spent")
      .eq("course_id", course.id);

    if (enrollError) throw enrollError;

    const allEnrollments = (enrollments ?? []) as any[];
    const enrollmentCount = allEnrollments.length;
    const completionCount = allEnrollments.filter(
      (e: any) => e.status === "completed"
    ).length;
    const completedWithScore = allEnrollments.filter(
      (e: any) => e.status === "completed" && e.score !== null
    );
    const avgScore =
      completedWithScore.length > 0
        ? Math.round(
            completedWithScore.reduce(
              (sum: number, e: any) => sum + e.score,
              0
            ) / completedWithScore.length
          )
        : null;
    const avgTimeSpent =
      enrollmentCount > 0
        ? Math.round(
            allEnrollments.reduce(
              (sum: number, e: any) => sum + (e.time_spent ?? 0),
              0
            ) / enrollmentCount
          )
        : 0;

    rows.push({
      course_title: course.title,
      enrollment_count: enrollmentCount,
      completion_count: completionCount,
      completion_rate:
        enrollmentCount > 0
          ? Math.round((completionCount / enrollmentCount) * 100)
          : 0,
      avg_score: avgScore,
      avg_time_spent: avgTimeSpent,
    });
  }

  rows.sort((a, b) => b.completion_rate - a.completion_rate);
  return rows;
}

/**
 * Generate a report by type. Shared between the API route and the cron job.
 */
export async function generateReport(
  reportType: ReportType,
  filters: ReportFilters = {}
): Promise<Record<string, unknown>[]> {
  const service = createServiceClient();

  switch (reportType) {
    case "completion":
      return generateCompletionReport(service, filters);
    case "compliance":
      return generateComplianceReport(service);
    case "skills_gap":
      return generateSkillsGapReport(service, filters);
    case "engagement":
      return generateEngagementReport(service, filters);
    case "learner_progress":
      return generateLearnerProgressReport(service, filters);
    case "course_effectiveness":
      return generateCourseEffectivenessReport(service);
    default:
      throw new Error(`Unsupported report type: ${reportType}`);
  }
}
