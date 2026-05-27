// Behavioral Nudges feature types.

export const NUDGE_CATEGORIES = [
  "Purpose",
  "Strategy",
  "Values",
  "Efficiency",
  "Customer",
  "Collaboration",
  "Empowered Teams",
  "Capability Development",
  "Learning",
  "Change Ready",
  "Future Focused",
  "Community",
  "Psychological Safety",
  "DEIA",
  "Wellbeing",
  "General",
] as const;

export type NudgeCategory = (typeof NUDGE_CATEGORIES)[number];

export type NudgeAssignmentStatus = "active" | "paused" | "completed";
export type NudgeFrequency = "daily" | "every_other_day" | "weekdays" | "custom";

export interface NudgeAction {
  id: string;
  organization_id: string | null;
  created_by: string | null;
  title: string;
  description: string;
  category: string;
  estimated_minutes: number;
  image_url: string;
  quote: string;
  quote_author: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface NudgeAssignment {
  id: string;
  organization_id: string | null;
  nudge_action_id: string;
  assignee_id: string | null;
  assigned_by: string | null;
  assignee_name: string;
  assignee_email: string;
  assignee_phone: string;
  status: NudgeAssignmentStatus;
  send_morning_email: boolean;
  send_morning_sms: boolean;
  send_evening_email: boolean;
  send_evening_sms: boolean;
  morning_send_time: string; // HH:MM
  evening_send_time: string; // HH:MM
  timezone: string;
  response_token: string;
  starts_on: string; // ISO date
  ends_on: string | null;
  campaign_id: string | null;
  campaign_enrollment_id: string | null;
  campaign_position: number | null;
  created_at: string;
  // Joined
  nudge_actions?: Pick<NudgeAction, "title" | "description" | "estimated_minutes" | "image_url" | "quote" | "quote_author">;
}

export interface NudgeDailyLog {
  id: string;
  assignment_id: string;
  log_date: string;
  morning_sent_at: string | null;
  morning_channel: string | null;
  committed: boolean | null;
  committed_at: string | null;
  evening_sent_at: string | null;
  evening_channel: string | null;
  completed: boolean | null;
  completed_at: string | null;
  reflection: string;
  created_at: string;
}

export interface NudgeStreak {
  id: string;
  assignment_id: string;
  current_streak: number;
  longest_streak: number;
  total_committed: number;
  total_completed: number;
  last_completed_date: string | null;
  updated_at: string;
}

export interface NudgeCampaign {
  id: string;
  organization_id: string | null;
  created_by: string | null;
  name: string;
  category: string;
  frequency: NudgeFrequency;
  frequency_days: number | null;
  send_morning_email: boolean;
  send_morning_sms: boolean;
  send_evening_email: boolean;
  send_evening_sms: boolean;
  morning_send_time: string;
  evening_send_time: string;
  timezone: string;
  status: NudgeAssignmentStatus;
  total_nudges: number;
  created_at: string;
  // Aggregates
  enrolledCount?: number;
  completedCount?: number;
}

export interface NudgeCampaignItem {
  id: string;
  campaign_id: string;
  nudge_action_id: string;
  position: number;
  nudge_actions?: Pick<NudgeAction, "title" | "image_url">;
}

export interface NudgeCampaignEnrollment {
  id: string;
  campaign_id: string;
  assignee_id: string | null;
  assignee_name: string;
  assignee_email: string;
  assignee_phone: string;
  current_position: number;
  current_assignment_id: string | null;
  status: NudgeAssignmentStatus;
  started_at: string;
  completed_at: string | null;
  created_at: string;
}

export interface NudgeActivitySummary {
  assignmentId: string;
  assigneeName: string;
  actionTitle: string;
  status: string;
  currentStreak: number;
  longestStreak: number;
  totalCommitted: number;
  totalCompleted: number;
  todayCommitted: boolean;
  todayCompleted: boolean;
  lastCompletedDate: string | null;
}

export interface NudgeActivityEvent {
  date: string;
  action: "committed" | "completed" | "skipped" | "swapped";
  actionTitle: string;
  reflection: string;
}
