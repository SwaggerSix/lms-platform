"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Download,
  Eye,
  TrendingUp,
  Award,
  AlertTriangle,
  Clock,
  BarChart3,
  Sparkles,
  ArrowUpDown,
  ShieldCheck,
  Loader2,
  ChevronDown,
  ChevronUp,
  X,
} from "lucide-react";
import { cn } from "@/utils/cn";
import { useToast } from "@/components/ui/toast";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type DateRange = "This Week" | "This Month" | "This Quarter" | "Custom";
type SortField = "name" | "assigned" | "completed" | "inProgress" | "overdue" | "avgScore" | "completionRate";
type SortDir = "asc" | "desc";

export interface TeamMember {
  name: string;
  initials: string;
  assigned: number;
  completed: number;
  inProgress: number;
  overdue: number;
  avgScore: number;
  completionRate: number;
}

export interface MonthlyActivity {
  month: string;
  hours: number;
  completions: number;
}

export interface SkillTrend {
  skill: string;
  prev: number;
  current: number;
  target: number;
}

export interface ReportsData {
  teamMembers: TeamMember[];
  monthlyActivity: MonthlyActivity[];
  skillTrends: SkillTrend[];
  completedThisMonth: number;
  avgCompletionTime: string;
  topPerformer: string;
  atRiskLearners: number;
}

type ReportCardKey = "completion" | "compliance" | "activity" | "skills";

/* ------------------------------------------------------------------ */
/*  CSV Export Utility (same pattern as admin reports)                  */
/* ------------------------------------------------------------------ */

const exportCSV = (data: Record<string, unknown>[], filename: string) => {
  if (data.length === 0) return;
  const headers = Object.keys(data[0]).join(",");
  const rows = data.map((row) =>
    Object.values(row)
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(",")
  );
  const csv = [headers, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function ReportsClient({ data }: { data: ReportsData }) {
  const router = useRouter();
  const toast = useToast();
  const [dateRange, setDateRange] = useState<DateRange>("This Month");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [expandedReport, setExpandedReport] = useState<ReportCardKey | null>(null);
  const [exportingAll, setExportingAll] = useState(false);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const sortedMembers = [...data.teamMembers].sort((a, b) => {
    const mul = sortDir === "asc" ? 1 : -1;
    if (sortField === "name") return mul * a.name.localeCompare(b.name);
    return mul * ((a[sortField] as number) - (b[sortField] as number));
  });

  const rateColor = (rate: number) =>
    rate >= 80 ? "text-green-600" : rate >= 50 ? "text-amber-600" : "text-red-600";

  const rateBg = (rate: number) =>
    rate >= 80 ? "bg-green-500" : rate >= 50 ? "bg-amber-500" : "bg-red-500";

  /* ---- Export Helpers ---- */

  const exportTeamProgressCSV = () => {
    const rows = data.teamMembers.map((m) => ({
      Name: m.name,
      "Assigned Courses": m.assigned,
      Completed: m.completed,
      "In Progress": m.inProgress,
      Overdue: m.overdue,
      "Avg Score (%)": m.avgScore,
      "Completion Rate (%)": m.completionRate,
    }));
    exportCSV(rows, `team-progress-report-${dateRange.toLowerCase().replace(/\s/g, "-")}.csv`);
    toast.success("Team Progress Report exported as CSV.");
  };

  const exportComplianceCSV = () => {
    const rows = data.teamMembers.map((m) => ({
      Name: m.name,
      "Assigned Courses": m.assigned,
      Completed: m.completed,
      "Completion Rate (%)": m.completionRate,
      Overdue: m.overdue,
      "Compliance Status": m.overdue === 0 ? "Compliant" : "Non-Compliant",
    }));
    exportCSV(rows, `compliance-status-report-${dateRange.toLowerCase().replace(/\s/g, "-")}.csv`);
    toast.success("Compliance Status Report exported as CSV.");
  };

  const exportActivityCSV = () => {
    const rows = data.monthlyActivity.map((m) => ({
      Month: m.month,
      "Learning Hours": m.hours,
      Completions: m.completions,
    }));
    exportCSV(rows, `learning-activity-report-${dateRange.toLowerCase().replace(/\s/g, "-")}.csv`);
    toast.success("Learning Activity Report exported as CSV.");
  };

  const exportSkillsCSV = () => {
    const rows = data.skillTrends.map((s) => ({
      Skill: s.skill,
      "Previous Level": s.prev,
      "Current Level": s.current,
      Target: s.target,
      Change: (s.current - s.prev).toFixed(1),
    }));
    exportCSV(rows, `skills-development-report-${dateRange.toLowerCase().replace(/\s/g, "-")}.csv`);
    toast.success("Skills Development Report exported as CSV.");
  };

  const handleExportAll = () => {
    setExportingAll(true);
    try {
      exportTeamProgressCSV();
      exportComplianceCSV();
      exportActivityCSV();
      exportSkillsCSV();
      toast.success("All reports exported.");
    } catch {
      toast.error("Failed to export some reports.");
    } finally {
      setExportingAll(false);
    }
  };

  /* ---- View Full Report Helpers ---- */

  const handleViewFullReport = (key: ReportCardKey) => {
    setExpandedReport(expandedReport === key ? null : key);
  };

  /* ---- CSV export for "Export All" button in table header ---- */

  const handleExportTableCSV = () => {
    exportTeamProgressCSV();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
          <p className="mt-1 text-sm text-gray-500">Comprehensive learning analytics and team performance.</p>
        </div>

        {/* ---- Date Range Selector ---- */}
        <div className="mb-6 flex flex-wrap items-center gap-2">
          {(["This Week", "This Month", "This Quarter", "Custom"] as DateRange[]).map((range) => (
            <button
              key={range}
              onClick={() => setDateRange(range)}
              className={cn(
                "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                dateRange === range
                  ? "bg-indigo-600 text-white"
                  : "border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
              )}
            >
              {range}
            </button>
          ))}
        </div>

        {/* ---- Quick Stats Row ---- */}
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Courses Completed This Month", value: data.completedThisMonth, icon: Award, color: "text-green-600", bg: "bg-green-50" },
            { label: "Avg Completion Time", value: data.avgCompletionTime, icon: Clock, color: "text-blue-600", bg: "bg-blue-50" },
            { label: "Top Performer", value: data.topPerformer, icon: TrendingUp, color: "text-purple-600", bg: "bg-purple-50" },
            { label: "At-Risk Learners", value: data.atRiskLearners, icon: AlertTriangle, color: "text-red-600", bg: "bg-red-50" },
          ].map((stat) => (
            <div key={stat.label} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">{stat.label}</p>
                  <p className="mt-1 text-2xl font-bold text-gray-900">{stat.value}</p>
                </div>
                <div className={cn("rounded-lg p-3", stat.bg)}>
                  <stat.icon className={cn("h-6 w-6", stat.color)} />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ---- Team Progress Report (Main Table) ---- */}
        <div className="mb-8 rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
            <div className="flex items-center gap-3">
              <BarChart3 className="h-5 w-5 text-indigo-600" />
              <h2 className="text-lg font-semibold text-gray-900">Team Progress Report</h2>
            </div>
            <button
              onClick={handleExportTableCSV}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
            >
              <Download className="h-3.5 w-3.5" /> Export All
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  {[
                    { key: "name" as SortField, label: "Name" },
                    { key: "assigned" as SortField, label: "Assigned Courses" },
                    { key: "completed" as SortField, label: "Completed" },
                    { key: "inProgress" as SortField, label: "In Progress" },
                    { key: "overdue" as SortField, label: "Overdue" },
                    { key: "avgScore" as SortField, label: "Avg Score" },
                    { key: "completionRate" as SortField, label: "Completion Rate" },
                  ].map((col) => (
                    <th key={col.key} className="px-6 py-3">
                      <button
                        onClick={() => handleSort(col.key)}
                        className="inline-flex items-center gap-1 hover:text-gray-700"
                      >
                        {col.label}
                        <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sortedMembers.map((member) => (
                  <tr key={member.name} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-xs font-medium text-indigo-700">
                          {member.initials}
                        </div>
                        <span className="text-sm font-medium text-gray-900">{member.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">{member.assigned}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">{member.completed}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">{member.inProgress}</td>
                    <td className="px-6 py-4">
                      <span className={cn("text-sm font-medium", member.overdue > 0 ? "text-red-600" : "text-gray-700")}>
                        {member.overdue}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{member.avgScore}%</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-20 overflow-hidden rounded-full bg-gray-200">
                          <div className={cn("h-full rounded-full", rateBg(member.completionRate))} style={{ width: `${member.completionRate}%` }} />
                        </div>
                        <span className={cn("text-sm font-bold", rateColor(member.completionRate))}>
                          {member.completionRate}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ---- Pre-built Report Cards (2x2) ---- */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Team Completion Report */}
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="rounded-lg bg-indigo-50 p-2.5">
                  <BarChart3 className="h-5 w-5 text-indigo-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Team Completion Report</h3>
                  <p className="text-sm text-gray-500">Course completion rates by team member</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleViewFullReport("completion")}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                >
                  <Eye className="h-3.5 w-3.5" /> View Full Report
                </button>
                <button
                  onClick={exportTeamProgressCSV}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                >
                  <Download className="h-3.5 w-3.5" /> Export CSV
                </button>
              </div>
            </div>
            {expandedReport === "completion" && (
              <div className="border-t border-gray-200 px-6 py-4">
                <div className="space-y-3">
                  {data.teamMembers.map((m) => (
                    <div key={m.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-100 text-xs font-medium text-indigo-700">
                          {m.initials}
                        </div>
                        <span className="text-sm text-gray-900">{m.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-20 overflow-hidden rounded-full bg-gray-200">
                          <div className={cn("h-full rounded-full", rateBg(m.completionRate))} style={{ width: `${m.completionRate}%` }} />
                        </div>
                        <span className={cn("text-xs font-bold", rateColor(m.completionRate))}>{m.completionRate}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Compliance Status Report */}
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="rounded-lg bg-green-50 p-2.5">
                  <ShieldCheck className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Compliance Status Report</h3>
                  <p className="text-sm text-gray-500">Regulatory training compliance by member</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleViewFullReport("compliance")}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                >
                  <Eye className="h-3.5 w-3.5" /> View Full Report
                </button>
                <button
                  onClick={exportComplianceCSV}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                >
                  <Download className="h-3.5 w-3.5" /> Export CSV
                </button>
              </div>
            </div>
            {expandedReport === "compliance" && (
              <div className="border-t border-gray-200 px-6 py-4">
                <div className="space-y-3">
                  {data.teamMembers.map((m) => (
                    <div key={m.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-100 text-xs font-medium text-indigo-700">
                          {m.initials}
                        </div>
                        <span className="text-sm text-gray-900">{m.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {m.overdue === 0 ? (
                          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">Compliant</span>
                        ) : (
                          <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">{m.overdue} overdue</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Learning Activity Report (bar chart mockup) */}
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-blue-50 p-2.5">
                    <TrendingUp className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">Learning Activity Report</h3>
                    <p className="text-sm text-gray-500">Monthly learning activity trends</p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleViewFullReport("activity")}
                    className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                    title="View Full Report"
                    aria-label={expandedReport === "activity" ? "Collapse activity report" : "Expand activity report"}
                  >
                    {expandedReport === "activity" ? (
                      <ChevronUp className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <ChevronDown className="h-4 w-4" aria-hidden="true" />
                    )}
                  </button>
                  <button
                    onClick={exportActivityCSV}
                    className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                    title="Export CSV"
                    aria-label="Export activity report as CSV"
                  >
                    <Download className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
              <div className="flex items-end gap-3 mt-2" style={{ height: 120 }}>
                {data.monthlyActivity.map((month) => {
                  const maxHours = Math.max(...data.monthlyActivity.map((m) => m.hours));
                  const barHeight = (month.hours / maxHours) * 100;
                  const compHeight = (month.completions / Math.max(...data.monthlyActivity.map((m) => m.completions))) * 100;
                  return (
                    <div key={month.month} className="flex flex-1 flex-col items-center gap-1">
                      <div className="flex items-end gap-0.5" style={{ height: 100 }}>
                        <div className="w-4 rounded-t bg-indigo-400 transition-all" style={{ height: `${barHeight}%` }} title={`${month.hours}h`} />
                        <div className="w-4 rounded-t bg-green-400 transition-all" style={{ height: `${compHeight}%` }} title={`${month.completions}`} />
                      </div>
                      <span className="text-[10px] font-medium text-gray-500">{month.month}</span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 flex items-center justify-center gap-4">
                <div className="flex items-center gap-1.5">
                  <div className="h-2.5 w-2.5 rounded bg-indigo-400" />
                  <span className="text-xs text-gray-500">Learning Hours</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-2.5 w-2.5 rounded bg-green-400" />
                  <span className="text-xs text-gray-500">Completions</span>
                </div>
              </div>
            </div>
            {expandedReport === "activity" && (
              <div className="border-t border-gray-200 px-6 py-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-left text-xs font-medium uppercase text-gray-500">
                      <th className="pb-2">Month</th>
                      <th className="pb-2 text-right">Learning Hours</th>
                      <th className="pb-2 text-right">Completions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {data.monthlyActivity.map((m) => (
                      <tr key={m.month}>
                        <td className="py-2 font-medium text-gray-900">{m.month}</td>
                        <td className="py-2 text-right text-gray-700">{m.hours}h</td>
                        <td className="py-2 text-right text-gray-700">{m.completions}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Skills Development Report (trend line mockup) */}
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-purple-50 p-2.5">
                    <Sparkles className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">Skills Development Report</h3>
                    <p className="text-sm text-gray-500">Track skill growth across the team</p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleViewFullReport("skills")}
                    className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                    title="View Full Report"
                    aria-label={expandedReport === "skills" ? "Collapse skills report" : "Expand skills report"}
                  >
                    {expandedReport === "skills" ? (
                      <ChevronUp className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <ChevronDown className="h-4 w-4" aria-hidden="true" />
                    )}
                  </button>
                  <button
                    onClick={exportSkillsCSV}
                    className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                    title="Export CSV"
                    aria-label="Export skills report as CSV"
                  >
                    <Download className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
              <div className="mt-2 space-y-2">
                {data.skillTrends.map((row) => {
                  const change = row.current - row.prev;
                  return (
                    <div key={row.skill} className="flex items-center gap-3">
                      <span className="w-24 text-xs font-medium text-gray-700 truncate">{row.skill}</span>
                      <div className="flex-1 h-2 overflow-hidden rounded-full bg-gray-200">
                        <div className="h-full rounded-full bg-purple-400" style={{ width: `${(row.current / 5) * 100}%` }} />
                      </div>
                      <span className={cn("text-xs font-bold", change > 0 ? "text-green-600" : "text-gray-500")}>
                        {change > 0 ? "+" : ""}{change.toFixed(1)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
            {expandedReport === "skills" && (
              <div className="border-t border-gray-200 px-6 py-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-left text-xs font-medium uppercase text-gray-500">
                      <th className="pb-2">Skill</th>
                      <th className="pb-2 text-right">Previous</th>
                      <th className="pb-2 text-right">Current</th>
                      <th className="pb-2 text-right">Target</th>
                      <th className="pb-2 text-right">Change</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {data.skillTrends.map((s) => {
                      const change = s.current - s.prev;
                      return (
                        <tr key={s.skill}>
                          <td className="py-2 font-medium text-gray-900">{s.skill}</td>
                          <td className="py-2 text-right text-gray-700">{s.prev}</td>
                          <td className="py-2 text-right text-gray-700">{s.current}</td>
                          <td className="py-2 text-right text-gray-700">{s.target}</td>
                          <td className={cn("py-2 text-right font-bold", change > 0 ? "text-green-600" : "text-gray-500")}>
                            {change > 0 ? "+" : ""}{change.toFixed(1)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Export All */}
        <div className="mt-8 flex justify-end">
          <button
            onClick={handleExportAll}
            disabled={exportingAll}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {exportingAll ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Export All Reports
          </button>
        </div>
      </div>
    </div>
  );
}
