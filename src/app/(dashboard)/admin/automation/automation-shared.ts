import {
  Award,
  Bell,
  BookOpen,
  Building2,
  CalendarDays,
  Clock,
  Play,
  Route,
  UserPlus,
  Users,
} from "lucide-react";

export interface RuleConditions {
  role?: string[];
  organization_id?: string[];
  hire_date_within_days?: number;
  job_title_contains?: string;
  completed_course_id?: string;
}

export interface RuleAction {
  type: "enroll_course" | "enroll_path" | "assign_badge" | "send_notification";
  course_id?: string;
  path_id?: string;
  badge_id?: string;
  due_days?: number;
  notification_text?: string;
}

export interface EnrollmentRule {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  trigger_type: string;
  conditions: RuleConditions;
  actions: RuleAction[];
  last_run_at: string | null;
  run_count: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface LogEntry {
  id: string;
  rule_id: string;
  user_id: string;
  action_type: string;
  action_target_id: string | null;
  status: "success" | "skipped" | "error";
  error_message: string | null;
  created_at: string;
  user?: { id: string; first_name: string; last_name: string; email: string };
}

export interface SelectOption {
  id: string;
  title?: string;
  name?: string;
}

export const TRIGGER_TYPES = [
  { value: "user_created", label: "New User Created", icon: UserPlus },
  { value: "role_changed", label: "Role Changed", icon: Users },
  { value: "org_changed", label: "Organization Changed", icon: Building2 },
  { value: "hire_date", label: "Within N Days of Hire Date", icon: CalendarDays },
  { value: "course_completed", label: "Course Completed", icon: BookOpen },
  { value: "schedule", label: "Scheduled (Periodic)", icon: Clock },
  { value: "manual", label: "Manual Trigger Only", icon: Play },
] as const;

export const ACTION_TYPES = [
  { value: "enroll_course", label: "Enroll in Course", icon: BookOpen },
  { value: "enroll_path", label: "Enroll in Learning Path", icon: Route },
  { value: "assign_badge", label: "Award Badge", icon: Award },
  { value: "send_notification", label: "Send Notification", icon: Bell },
] as const;

export const ROLES = ["admin", "manager", "instructor", "learner"];

export function getTriggerLabel(value: string): string {
  return TRIGGER_TYPES.find((t) => t.value === value)?.label ?? value;
}

export function getActionLabel(value: string): string {
  return ACTION_TYPES.find((a) => a.value === value)?.label ?? value;
}

export function formatDate(dateStr: string | null): string {
  if (!dateStr) return "Never";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function conditionsSummary(conditions: RuleConditions, organizations: SelectOption[]): string {
  const parts: string[] = [];
  if (conditions.role?.length) parts.push(`Role: ${conditions.role.join(", ")}`);
  if (conditions.organization_id?.length) {
    const orgNames = conditions.organization_id.map((oid) => {
      const org = organizations.find((o) => o.id === oid);
      return org?.name ?? oid.slice(0, 8);
    });
    parts.push(`Org: ${orgNames.join(", ")}`);
  }
  if (conditions.hire_date_within_days) parts.push(`Hire date within ${conditions.hire_date_within_days}d`);
  if (conditions.job_title_contains) parts.push(`Title contains "${conditions.job_title_contains}"`);
  if (conditions.completed_course_id) parts.push("Completed specific course");
  return parts.length > 0 ? parts.join(" + ") : "No conditions (all users)";
}
