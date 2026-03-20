"use client";

import { useState } from "react";
import {
  Calendar,
  Clock,
  Plus,
  Play,
  Pencil,
  Trash2,
  X,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Send,
  Download,
  FileText,
  FileSpreadsheet,
  File,
  ChevronDown,
  ChevronRight,
  Users,
  Mail,
  Timer,
} from "lucide-react";
import { cn } from "@/utils/cn";
import type { ScheduledReport, ReportFrequency, ReportFormat } from "@/types/database";

// ── Exported Types ──

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

export interface ScheduledReportsClientProps {
  initialReports: ScheduledReportWithHistory[];
}

// ── Helpers ──

const reportTypeConfig: Record<string, { label: string; color: string; bg: string }> = {
  completion: { label: "Completion", color: "text-green-700", bg: "bg-green-100" },
  compliance: { label: "Compliance", color: "text-blue-700", bg: "bg-blue-100" },
  enrollment: { label: "Enrollment", color: "text-indigo-700", bg: "bg-indigo-100" },
  skills_gap: { label: "Skills Gap", color: "text-purple-700", bg: "bg-purple-100" },
  engagement: { label: "Engagement", color: "text-orange-700", bg: "bg-orange-100" },
  learner_progress: { label: "Learner Progress", color: "text-teal-700", bg: "bg-teal-100" },
  ilt_attendance: { label: "ILT Attendance", color: "text-rose-700", bg: "bg-rose-100" },
  custom: { label: "Custom", color: "text-gray-700", bg: "bg-gray-100" },
};

const frequencyLabels: Record<ReportFrequency, string> = {
  daily: "Daily",
  weekly: "Weekly",
  biweekly: "Biweekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
};

const frequencyColors: Record<ReportFrequency, string> = {
  daily: "bg-yellow-100 text-yellow-700",
  weekly: "bg-sky-100 text-sky-700",
  biweekly: "bg-cyan-100 text-cyan-700",
  monthly: "bg-violet-100 text-violet-700",
  quarterly: "bg-amber-100 text-amber-700",
};

const dayOfWeekLabels = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const timezones = [
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

const reportTypes = [
  { value: "completion", label: "Completion" },
  { value: "compliance", label: "Compliance" },
  { value: "enrollment", label: "Enrollment" },
  { value: "skills_gap", label: "Skills Gap" },
  { value: "engagement", label: "Engagement" },
  { value: "learner_progress", label: "Learner Progress" },
  { value: "ilt_attendance", label: "ILT Attendance" },
  { value: "custom", label: "Custom" },
];

function formatDateTime(iso: string | null): string {
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

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function FormatIcon({ format }: { format: ReportFormat }) {
  switch (format) {
    case "pdf":
      return <FileText className="h-4 w-4 text-red-500" />;
    case "csv":
      return <File className="h-4 w-4 text-green-500" />;
    case "xlsx":
      return <FileSpreadsheet className="h-4 w-4 text-emerald-600" />;
  }
}

function getScheduleDescription(form: {
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

// ── Component ──

export default function ScheduledReportsClient({ initialReports }: ScheduledReportsClientProps) {
  const [reports, setReports] = useState(initialReports);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [expandedReport, setExpandedReport] = useState<string | null>(null);
  const [hoveredRecipients, setHoveredRecipients] = useState<string | null>(null);

  // Create schedule form state
  const [formName, setFormName] = useState("");
  const [formType, setFormType] = useState("completion");
  const [formFrequency, setFormFrequency] = useState<ReportFrequency>("weekly");
  const [formDay, setFormDay] = useState<number>(1);
  const [formTime, setFormTime] = useState("09:00");
  const [formTimezone, setFormTimezone] = useState("America/New_York");
  const [formDelivery, setFormDelivery] = useState<"email" | "download" | "both">("email");
  const [formRecipients, setFormRecipients] = useState<string[]>([]);
  const [formRecipientInput, setFormRecipientInput] = useState("");
  const [formFormat, setFormFormat] = useState<ReportFormat>("pdf");
  const [formDateFrom, setFormDateFrom] = useState("2026-03-01");
  const [formDateTo, setFormDateTo] = useState("2026-03-16");
  const [formDepartment, setFormDepartment] = useState("all");
  const [formRole, setFormRole] = useState("all");
  const [formCourse, setFormCourse] = useState("all");

  // Stats
  const activeCount = reports.filter((r) => r.is_active).length;
  const reportsSentThisMonth = reports
    .flatMap((r) => r.runHistory)
    .filter((h) => {
      const d = new Date(h.runDate);
      return d.getMonth() === 2 && d.getFullYear() === 2026 && h.status === "success";
    }).length;
  const nextScheduled = reports
    .filter((r) => r.is_active && r.next_run_at)
    .sort((a, b) => new Date(a.next_run_at!).getTime() - new Date(b.next_run_at!).getTime())[0];
  const failedDeliveries = reports
    .flatMap((r) => r.runHistory)
    .filter((h) => h.status === "failed").length;

  const toggleActive = async (id: string) => {
    const report = reports.find((r) => r.id === id);
    if (!report) return;

    const newIsActive = !report.is_active;

    try {
      const res = await fetch("/api/scheduled-reports", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          is_active: newIsActive,
          next_run_at: newIsActive ? new Date().toISOString() : null,
        }),
      });

      if (!res.ok) throw new Error("Failed to toggle report status");

      setReports((prev) =>
        prev.map((r) =>
          r.id === id
            ? {
                ...r,
                is_active: newIsActive,
                next_run_at: newIsActive ? new Date().toISOString() : null,
                updated_at: new Date().toISOString(),
              }
            : r
        )
      );
    } catch (err) {
      console.error("Error toggling report active status:", err);
    }
  };

  const deleteReport = async (id: string) => {
    try {
      const res = await fetch(`/api/scheduled-reports?id=${id}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to delete report");

      setReports((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      console.error("Error deleting report:", err);
    }
  };

  const addRecipient = () => {
    const email = formRecipientInput.trim();
    if (email && email.includes("@") && !formRecipients.includes(email)) {
      setFormRecipients([...formRecipients, email]);
      setFormRecipientInput("");
    }
  };

  const removeRecipient = (email: string) => {
    setFormRecipients(formRecipients.filter((r) => r !== email));
  };

  const resetForm = () => {
    setFormName("");
    setFormType("completion");
    setFormFrequency("weekly");
    setFormDay(1);
    setFormTime("09:00");
    setFormTimezone("America/New_York");
    setFormDelivery("email");
    setFormRecipients([]);
    setFormRecipientInput("");
    setFormFormat("pdf");
    setFormDateFrom("2026-03-01");
    setFormDateTo("2026-03-16");
    setFormDepartment("all");
    setFormRole("all");
    setFormCourse("all");
  };

  const handleCreateSchedule = async () => {
    if (!formName.trim()) return;

    try {
      const res = await fetch("/api/scheduled-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName,
          report_type: formType,
          filters: { date_range: `${formDateFrom}_to_${formDateTo}`, department: formDepartment, role: formRole, course: formCourse },
          schedule_frequency: formFrequency,
          schedule_day: formFrequency === "daily" ? null : formDay,
          schedule_time: formTime,
          schedule_timezone: formTimezone,
          delivery_method: formDelivery,
          recipients: formRecipients,
          format: formFormat,
        }),
      });

      if (!res.ok) throw new Error("Failed to create scheduled report");

      const { scheduled_report: created } = await res.json();

      const newReport: (typeof reports)[0] = {
        id: created.id,
        name: created.name,
        description: created.description,
        report_type: created.report_type,
        filters: created.filters,
        schedule_frequency: created.schedule_frequency,
        schedule_day: created.schedule_day,
        schedule_time: created.schedule_time,
        schedule_timezone: created.schedule_timezone,
        delivery_method: created.delivery_method,
        recipients: created.recipients,
        format: created.format,
        is_active: created.is_active,
        last_run_at: created.last_run_at,
        next_run_at: created.next_run_at,
        created_by: created.created_by,
        created_at: created.created_at,
        updated_at: created.updated_at,
        runHistory: [],
      };

      setReports((prev) => [newReport, ...prev]);
      resetForm();
      setShowCreateModal(false);
    } catch (err) {
      console.error("Error creating scheduled report:", err);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Scheduled Reports</h1>
          <p className="mt-1 text-sm text-gray-500">Manage automated report delivery and scheduling</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Create Schedule
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100">
              <Calendar className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Active Schedules</p>
              <p className="text-2xl font-bold text-gray-900">{activeCount}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100">
              <Send className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Reports Sent This Month</p>
              <p className="text-2xl font-bold text-gray-900">{reportsSentThisMonth}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-100">
              <Timer className="h-5 w-5 text-sky-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Next Scheduled Run</p>
              <p className="text-sm font-semibold text-gray-900">
                {nextScheduled ? formatDateTime(nextScheduled.next_run_at) : "None"}
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Failed Deliveries</p>
              <p className="text-2xl font-bold text-gray-900">{failedDeliveries}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Scheduled Reports Table */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Report Schedules</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Report Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Frequency</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Next Run</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Last Run</th>
                <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">Recipients</th>
                <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">Format</th>
                <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">Status</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {reports.map((report) => {
                const typeConf = reportTypeConfig[report.report_type] || reportTypeConfig.custom;
                const lastRunSuccess = report.runHistory.length > 0 ? report.runHistory[0].status === "success" : null;

                return (
                  <tr key={report.id} className="group">
                    {/* Expand toggle + name */}
                    <td className="px-6 py-4">
                      <button
                        onClick={() => setExpandedReport(expandedReport === report.id ? null : report.id)}
                        className="flex items-center gap-2 text-left"
                      >
                        {expandedReport === report.id ? (
                          <ChevronDown className="h-4 w-4 text-gray-400" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-gray-400" />
                        )}
                        <div>
                          <p className="text-sm font-medium text-gray-900">{report.name}</p>
                          {report.description && (
                            <p className="text-xs text-gray-500 max-w-[200px] truncate">{report.description}</p>
                          )}
                        </div>
                      </button>
                    </td>

                    {/* Type badge */}
                    <td className="px-4 py-4">
                      <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium", typeConf.bg, typeConf.color)}>
                        {typeConf.label}
                      </span>
                    </td>

                    {/* Frequency badge */}
                    <td className="px-4 py-4">
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
                          frequencyColors[report.schedule_frequency]
                        )}
                      >
                        {frequencyLabels[report.schedule_frequency]}
                      </span>
                    </td>

                    {/* Next run */}
                    <td className="px-4 py-4 text-sm text-gray-600">{formatDateTime(report.next_run_at)}</td>

                    {/* Last run with status indicator */}
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-1.5">
                        {lastRunSuccess === true && <CheckCircle className="h-3.5 w-3.5 text-green-500" />}
                        {lastRunSuccess === false && <XCircle className="h-3.5 w-3.5 text-red-500" />}
                        <span className="text-sm text-gray-600">{formatDateTime(report.last_run_at)}</span>
                      </div>
                    </td>

                    {/* Recipients */}
                    <td className="px-4 py-4 text-center">
                      <div
                        className="relative inline-block"
                        onMouseEnter={() => setHoveredRecipients(report.id)}
                        onMouseLeave={() => setHoveredRecipients(null)}
                      >
                        <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700 cursor-default">
                          <Users className="h-3 w-3" />
                          {report.recipients.length}
                        </span>
                        {hoveredRecipients === report.id && (
                          <div className="absolute z-10 mt-1 left-1/2 -translate-x-1/2 rounded-lg bg-gray-900 px-3 py-2 shadow-lg">
                            {report.recipients.map((email) => (
                              <p key={email} className="whitespace-nowrap text-xs text-white">
                                {email}
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Format */}
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-center gap-1.5">
                        <FormatIcon format={report.format} />
                        <span className="text-xs font-medium text-gray-600 uppercase">{report.format}</span>
                      </div>
                    </td>

                    {/* Active toggle */}
                    <td className="px-4 py-4 text-center">
                      <button
                        onClick={() => toggleActive(report.id)}
                        className={cn(
                          "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                          report.is_active ? "bg-indigo-600" : "bg-gray-300"
                        )}
                      >
                        <span
                          className={cn(
                            "inline-block h-4 w-4 rounded-full bg-white transition-transform",
                            report.is_active ? "translate-x-6" : "translate-x-1"
                          )}
                        />
                      </button>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          title="Edit"
                          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          title="Run Now"
                          className="rounded-lg p-1.5 text-gray-400 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                        >
                          <Play className="h-4 w-4" />
                        </button>
                        <button
                          title="Delete"
                          onClick={() => deleteReport(report.id)}
                          className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Expanded Run History */}
        {expandedReport && (
          <div className="border-t border-gray-200 bg-gray-50 px-6 py-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">
              Run History &mdash; {reports.find((r) => r.id === expandedReport)?.name}
            </h3>
            <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Run Date</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Status</th>
                    <th className="px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Records</th>
                    <th className="px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wider text-gray-500">File Size</th>
                    <th className="px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Download</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {reports
                    .find((r) => r.id === expandedReport)
                    ?.runHistory.map((entry) => (
                      <tr key={entry.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-2.5 text-sm text-gray-700">{formatDate(entry.runDate)}</td>
                        <td className="px-4 py-2.5">
                          {entry.status === "success" ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                              <CheckCircle className="h-3 w-3" /> Success
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                              <XCircle className="h-3 w-3" /> Failed
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right text-sm text-gray-700">{entry.records.toLocaleString()}</td>
                        <td className="px-4 py-2.5 text-right text-sm text-gray-500">{entry.fileSize}</td>
                        <td className="px-4 py-2.5 text-right">
                          {entry.status === "success" ? (
                            <button className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50 transition-colors">
                              <Download className="h-3 w-3" /> Download
                            </button>
                          ) : (
                            <span className="text-xs text-gray-400">N/A</span>
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Create Schedule Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">Create Report Schedule</h2>
              <button
                onClick={() => {
                  resetForm();
                  setShowCreateModal(false);
                }}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-6 px-6 py-5">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Report Name</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g., Weekly Enrollment Summary"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {/* Report Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Report Type</label>
                <select
                  value={formType}
                  onChange={(e) => setFormType(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  {reportTypes.map((rt) => (
                    <option key={rt.value} value={rt.value}>
                      {rt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Frequency + Day */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Frequency</label>
                  <select
                    value={formFrequency}
                    onChange={(e) => setFormFrequency(e.target.value as ReportFrequency)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="biweekly">Biweekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                  </select>
                </div>

                {/* Day selector -- varies by frequency */}
                {formFrequency !== "daily" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      {formFrequency === "weekly" || formFrequency === "biweekly" ? "Day of Week" : "Day of Month"}
                    </label>
                    {formFrequency === "weekly" || formFrequency === "biweekly" ? (
                      <select
                        value={formDay}
                        onChange={(e) => setFormDay(Number(e.target.value))}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      >
                        {dayOfWeekLabels.map((d, i) => (
                          <option key={i} value={i}>
                            {d}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <select
                        value={formDay}
                        onChange={(e) => setFormDay(Number(e.target.value))}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      >
                        {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                )}
              </div>

              {/* Time + Timezone */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Time</label>
                  <input
                    type="time"
                    value={formTime}
                    onChange={(e) => setFormTime(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Timezone</label>
                  <select
                    value={formTimezone}
                    onChange={(e) => setFormTimezone(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    {timezones.map((tz) => (
                      <option key={tz} value={tz}>
                        {tz.replace("_", " ")}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Delivery Method */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Delivery Method</label>
                <div className="flex gap-3">
                  {(["email", "download", "both"] as const).map((method) => (
                    <button
                      key={method}
                      onClick={() => setFormDelivery(method)}
                      className={cn(
                        "flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                        formDelivery === method
                          ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                          : "border-gray-300 text-gray-600 hover:bg-gray-50"
                      )}
                    >
                      <div className="flex items-center justify-center gap-1.5">
                        {method === "email" && <Mail className="h-4 w-4" />}
                        {method === "download" && <Download className="h-4 w-4" />}
                        {method === "both" && (
                          <>
                            <Mail className="h-3.5 w-3.5" />
                            <span>+</span>
                            <Download className="h-3.5 w-3.5" />
                          </>
                        )}
                        <span className="capitalize">{method}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Recipients */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Recipients</label>
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={formRecipientInput}
                    onChange={(e) => setFormRecipientInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addRecipient();
                      }
                    }}
                    placeholder="Enter email address"
                    className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <button
                    onClick={addRecipient}
                    className="rounded-lg bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors"
                  >
                    Add
                  </button>
                </div>
                {formRecipients.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {formRecipients.map((email) => (
                      <span
                        key={email}
                        className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-medium text-indigo-700"
                      >
                        {email}
                        <button onClick={() => removeRecipient(email)} className="hover:text-indigo-900">
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Format */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Format</label>
                <div className="flex gap-3">
                  {(["pdf", "csv", "xlsx"] as const).map((fmt) => (
                    <button
                      key={fmt}
                      onClick={() => setFormFormat(fmt)}
                      className={cn(
                        "flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                        formFormat === fmt
                          ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                          : "border-gray-300 text-gray-600 hover:bg-gray-50"
                      )}
                    >
                      <div className="flex items-center justify-center gap-1.5">
                        <FormatIcon format={fmt} />
                        <span className="uppercase">{fmt}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Preview Description */}
              <div className="rounded-lg bg-indigo-50 border border-indigo-200 px-4 py-3">
                <div className="flex items-start gap-2">
                  <Clock className="h-4 w-4 text-indigo-600 mt-0.5" />
                  <p className="text-sm text-indigo-700">
                    {getScheduleDescription({
                      schedule_frequency: formFrequency,
                      schedule_day: formFrequency === "daily" ? null : formDay,
                      schedule_time: formTime,
                      schedule_timezone: formTimezone,
                      recipients: formRecipients,
                    })}
                  </p>
                </div>
              </div>

              {/* Filters Section */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Filters</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Date Range From</label>
                    <input
                      type="date"
                      value={formDateFrom}
                      onChange={(e) => setFormDateFrom(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Date Range To</label>
                    <input
                      type="date"
                      value={formDateTo}
                      onChange={(e) => setFormDateTo(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Department</label>
                    <select
                      value={formDepartment}
                      onChange={(e) => setFormDepartment(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="all">All Departments</option>
                      <option value="executive">Executive</option>
                      <option value="hr">HR</option>
                      <option value="operations">Operations</option>
                      <option value="finance">Finance</option>
                      <option value="training-delivery">Training Delivery</option>
                      <option value="training-development">Training Development</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Role</label>
                    <select
                      value={formRole}
                      onChange={(e) => setFormRole(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="all">All Roles</option>
                      <option value="employee">Employee</option>
                      <option value="manager">Manager</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Course</label>
                    <select
                      value={formCourse}
                      onChange={(e) => setFormCourse(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="all">All Courses</option>
                      <option value="advanced-react">Advanced React Patterns</option>
                      <option value="cloud-arch">Cloud Architecture</option>
                      <option value="data-privacy">Data Privacy Essentials</option>
                      <option value="negotiation">Negotiation Skills</option>
                      <option value="workplace-safety">Workplace Safety 2026</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
              <button
                onClick={() => {
                  resetForm();
                  setShowCreateModal(false);
                }}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateSchedule}
                disabled={!formName.trim()}
                className={cn(
                  "rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors",
                  formName.trim() ? "bg-indigo-600 hover:bg-indigo-700" : "bg-indigo-300 cursor-not-allowed"
                )}
              >
                Create Schedule
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
