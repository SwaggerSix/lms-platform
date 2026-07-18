import { File, FileSpreadsheet, FileText } from "lucide-react";
import type { ScheduledReport, ReportFrequency, ReportFormat } from "@/types/database";

export interface RunHistoryEntry {
  id: string;
  runDate: string;
  status: "success" | "failed";
  records: number;
  fileSize: string;
}

export interface ScheduledReportWithHistory extends ScheduledReport {
  runHistory: RunHistoryEntry[];
  creator?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string;
  } | null;
}

export const reportTypeConfig: Record<string, { label: string; color: string; bg: string }> = {
  completion: { label: "Completion", color: "text-green-700", bg: "bg-green-100" },
  compliance: { label: "Compliance", color: "text-blue-700", bg: "bg-blue-100" },
  enrollment: { label: "Enrollment", color: "text-primary-700", bg: "bg-primary-100" },
  skills_gap: { label: "Skills Gap", color: "text-purple-700", bg: "bg-purple-100" },
  engagement: { label: "Engagement", color: "text-orange-700", bg: "bg-orange-100" },
  learner_progress: { label: "Learner Progress", color: "text-teal-700", bg: "bg-teal-100" },
  at_risk: { label: "At-Risk Learners", color: "text-red-700", bg: "bg-red-100" },
  training_matrix: { label: "Training Matrix", color: "text-primary-700", bg: "bg-primary-100" },
  ilt_attendance: { label: "Webinar Attendance", color: "text-rose-700", bg: "bg-rose-100" },
  custom: { label: "Custom", color: "text-gray-700", bg: "bg-gray-100" },
};

export const frequencyLabels: Record<ReportFrequency, string> = {
  daily: "Daily",
  weekly: "Weekly",
  biweekly: "Biweekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
};

export const frequencyColors: Record<ReportFrequency, string> = {
  daily: "bg-yellow-100 text-yellow-700",
  weekly: "bg-sky-100 text-sky-700",
  biweekly: "bg-cyan-100 text-cyan-700",
  monthly: "bg-violet-100 text-violet-700",
  quarterly: "bg-amber-100 text-amber-700",
};

export const dayOfWeekLabels = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export const timezones = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
  "Europe/London",
  "Europe/Berlin",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Australia/Sydney",
];

export const reportTypes = [
  { value: "completion", label: "Completion" },
  { value: "compliance", label: "Compliance" },
  { value: "enrollment", label: "Enrollment" },
  { value: "skills_gap", label: "Skills Gap" },
  { value: "engagement", label: "Engagement" },
  { value: "learner_progress", label: "Learner Progress" },
  { value: "at_risk", label: "At-Risk Learners" },
  { value: "training_matrix", label: "Training Matrix" },
  { value: "ilt_attendance", label: "Webinar Attendance" },
  { value: "custom", label: "Custom" },
];

export function formatDateTime(iso: string | null): string {
  if (!iso) return "N/A";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function FormatIcon({ format }: { format: ReportFormat }) {
  switch (format) {
    case "pdf":
      return <FileText className="h-4 w-4 text-red-500" />;
    case "csv":
      return <File className="h-4 w-4 text-green-500" />;
    case "xlsx":
      return <FileSpreadsheet className="h-4 w-4 text-emerald-600" />;
  }
}

export function getScheduleDescription(form: {
  schedule_frequency: ReportFrequency;
  schedule_day: number | null;
  schedule_time: string;
  schedule_timezone: string;
  recipients: string[];
}): string {
  const { schedule_frequency, schedule_day, schedule_time, schedule_timezone, recipients } = form;
  const tz = schedule_timezone.split("/").pop()?.replace("_", " ") || schedule_timezone;
  const time = schedule_time || "9:00 AM";

  let freq = "";
  switch (schedule_frequency) {
    case "daily":
      freq = `every day at ${time} ${tz}`;
      break;
    case "weekly":
      freq = `every ${dayOfWeekLabels[schedule_day ?? 1]} at ${time} ${tz}`;
      break;
    case "biweekly":
      freq = `every other ${dayOfWeekLabels[schedule_day ?? 5]} at ${time} ${tz}`;
      break;
    case "monthly":
      freq = `on day ${schedule_day ?? 1} of each month at ${time} ${tz}`;
      break;
    case "quarterly":
      freq = `on day ${schedule_day ?? 1} of each quarter at ${time} ${tz}`;
      break;
  }

  return `This report will run ${freq} and be emailed to ${recipients.length} recipient${recipients.length !== 1 ? "s" : ""}.`;
}
