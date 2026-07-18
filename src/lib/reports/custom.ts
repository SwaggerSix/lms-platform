import { createServiceClient } from "@/lib/supabase/service";
import {
  getEnrollmentActivity,
  getCourseLessonCounts,
  progressPercent,
} from "@/lib/analytics/predictive";
import { generateReport } from "@/lib/reports/generate";

/**
 * Custom report builder: datasets, their column registries, and the runner.
 * A saved definition is { dataset, columns[], filters{}, sort_by, sort_dir } —
 * queries are assembled here from the registry, so definitions never carry
 * SQL or arbitrary field names.
 */

const PAGE_SIZE = 1000;

export const ENROLLMENT_STATUSES = [
  "enrolled",
  "in_progress",
  "completed",
  "failed",
  "expired",
] as const;

export interface DatasetColumn {
  label: string;
}

export interface DatasetMeta {
  label: string;
  columns: Record<string, DatasetColumn>;
  /** Filter keys this dataset honors. */
  filters: readonly string[];
}

export const REPORT_DATASETS: Record<string, DatasetMeta> = {
  enrollments: {
    label: "Enrollments",
    columns: {
      user_name: { label: "Learner" },
      email: { label: "Email" },
      department: { label: "Department" },
      course_title: { label: "Course" },
      status: { label: "Status" },
      progress: { label: "Progress %" },
      score: { label: "Score" },
      enrolled_at: { label: "Enrolled" },
      completed_at: { label: "Completed" },
      due_date: { label: "Due Date" },
      time_spent: { label: "Time Spent (min)" },
    },
    filters: ["date_from", "date_to", "department", "status"],
  },
  learners: {
    label: "Learners",
    columns: {
      user_name: { label: "Learner" },
      email: { label: "Email" },
      department: { label: "Department" },
      courses_assigned: { label: "Courses Assigned" },
      courses_completed: { label: "Courses Completed" },
      completion_rate: { label: "Completion Rate %" },
      avg_score: { label: "Avg Score" },
      total_hours: { label: "Total Hours" },
    },
    filters: ["department"],
  },
  courses: {
    label: "Courses",
    columns: {
      course_title: { label: "Course" },
      enrollment_count: { label: "Enrollments" },
      completion_count: { label: "Completions" },
      completion_rate: { label: "Completion Rate %" },
      avg_score: { label: "Avg Score" },
      avg_time_spent: { label: "Avg Time (min)" },
    },
    filters: [],
  },
};

export interface DefinitionSpec {
  dataset: string;
  columns: string[];
  filters: Record<string, string>;
  sort_by?: string | null;
  sort_dir?: string | null;
}

/** Validate a spec against the registry. Returns an error message or null. */
export function validateDefinitionSpec(spec: DefinitionSpec): string | null {
  const meta = REPORT_DATASETS[spec.dataset];
  if (!meta) {
    return `Unknown dataset. Must be one of: ${Object.keys(REPORT_DATASETS).join(", ")}`;
  }
  if (!Array.isArray(spec.columns) || spec.columns.length === 0) {
    return "At least one column is required";
  }
  for (const col of spec.columns) {
    if (!meta.columns[col]) {
      return `Unknown column "${col}" for dataset "${spec.dataset}"`;
    }
  }
  const filters = spec.filters ?? {};
  for (const key of Object.keys(filters)) {
    if (filters[key] === undefined || filters[key] === null || filters[key] === "") continue;
    if (!meta.filters.includes(key)) {
      return `Filter "${key}" is not supported by dataset "${spec.dataset}"`;
    }
  }
  if (
    filters.status &&
    !(ENROLLMENT_STATUSES as readonly string[]).includes(filters.status)
  ) {
    return `Invalid status filter. Must be one of: ${ENROLLMENT_STATUSES.join(", ")}`;
  }
  if (spec.sort_by && !spec.columns.includes(spec.sort_by)) {
    return "sort_by must be one of the selected columns";
  }
  if (spec.sort_dir && spec.sort_dir !== "asc" && spec.sort_dir !== "desc") {
    return 'sort_dir must be "asc" or "desc"';
  }
  return null;
}

/** Full enrollment rows (all registry columns), with progress derived. */
async function fetchEnrollmentRows(
  filters: Record<string, string>,
  needProgress: boolean
): Promise<Record<string, unknown>[]> {
  const service = createServiceClient();
  const all: any[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    let query = service
      .from("enrollments")
      .select(
        "id, course_id, status, score, enrolled_at, completed_at, due_date, time_spent, user:users!enrollments_user_id_fkey!inner(first_name, last_name, email, organization:organizations(name)), course:courses(title)"
      )
      .range(offset, offset + PAGE_SIZE - 1);
    if (filters.date_from) query = query.gte("enrolled_at", filters.date_from);
    if (filters.date_to) query = query.lte("enrolled_at", filters.date_to);
    if (filters.department) query = query.eq("user.organization_id", filters.department);
    if (filters.status) query = query.eq("status", filters.status);
    const { data, error } = await query;
    if (error) throw error;
    const batch = (data ?? []) as any[];
    all.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }

  let activity = new Map<string, { completedLessons: number; lastAccessedAt: string | null }>();
  let lessonCounts = new Map<string, number>();
  if (needProgress && all.length > 0) {
    [activity, lessonCounts] = await Promise.all([
      getEnrollmentActivity(service, all.map((e) => e.id)),
      getCourseLessonCounts(service, all.map((e) => e.course_id)),
    ]);
  }

  return all.map((row: any) => ({
    user_name:
      `${row.user?.first_name ?? ""} ${row.user?.last_name ?? ""}`.trim() || "Unknown",
    email: row.user?.email ?? "",
    department: row.user?.organization?.name ?? "N/A",
    course_title: row.course?.title ?? "Unknown",
    status: row.status,
    progress: needProgress
      ? row.status === "completed"
        ? 100
        : progressPercent(
            activity.get(row.id)?.completedLessons ?? 0,
            lessonCounts.get(row.course_id)
          )
      : null,
    score: row.score,
    enrolled_at: row.enrolled_at,
    completed_at: row.completed_at,
    due_date: row.due_date,
    time_spent: row.time_spent,
  }));
}

/**
 * Run a definition spec: fetch the dataset, project the selected columns (in
 * order, keyed by their display labels so exports read well), and sort.
 */
export async function runReportDefinition(
  spec: DefinitionSpec
): Promise<Record<string, unknown>[]> {
  const error = validateDefinitionSpec(spec);
  if (error) throw new Error(error);
  const meta = REPORT_DATASETS[spec.dataset];
  const filters = spec.filters ?? {};

  let base: Record<string, unknown>[];
  switch (spec.dataset) {
    case "enrollments":
      base = await fetchEnrollmentRows(filters, spec.columns.includes("progress"));
      break;
    case "learners":
      // The learner_progress generator already produces every registry column.
      base = await generateReport("learner_progress", {
        department: filters.department || undefined,
      });
      break;
    case "courses":
      base = await generateReport("course_effectiveness");
      break;
    default:
      throw new Error(`Unknown dataset: ${spec.dataset}`);
  }

  if (spec.sort_by) {
    const key = spec.sort_by;
    const dir = spec.sort_dir === "desc" ? -1 : 1;
    base = [...base].sort((a, b) => {
      const av = a[key];
      const bv = b[key];
      if (av === null || av === undefined) return 1; // nulls last
      if (bv === null || bv === undefined) return -1;
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
  }

  return base.map((row) => {
    const projected: Record<string, unknown> = {};
    for (const col of spec.columns) {
      projected[meta.columns[col].label] = row[col] ?? null;
    }
    return projected;
  });
}
