"use client";

import { useState, useCallback, useEffect } from "react";
import AdminAnalyticsTabs from "@/components/layout/admin-analytics-tabs";
import {
  CheckCircle,
  ShieldCheck,
  BarChart3,
  TrendingUp,
  Target,
  Users,
  Download,
  Eye,
  FileText,
  Filter,
  Table,
  Loader2,
  AlertTriangle,
  BellRing,
} from "lucide-react";
import { cn } from "@/utils/cn";
import { ReportViewerModal, type ReportColumn } from "@/components/ui/report-viewer-modal";
import {
  Table as UITable,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";

export interface ReportRow {
  userName: string;
  department: string;
  course: string;
  status: string;
  score: number;
  completionDate: string;
  timeSpent: string;
  certificate: string;
}

export interface RecentReport {
  id: string;
  name: string;
  generatedDate: string;
  generatedBy: string;
  rowCount: number;
}

export interface ReportSummary {
  totalEnrollments: number;
  inProgressCount: number;
  completedCount: number;
  activeUsersCount: number;
  publishedCoursesCount: number;
  complianceRate: number;
}

export interface ReportsClientProps {
  reportData: ReportRow[];
  recentReports: RecentReport[];
  summary: ReportSummary;
}

const reportTemplates = [
  { id: "1", name: "Completion Report", description: "Track course and path completion rates", icon: <CheckCircle className="h-6 w-6" />, color: "text-green-600", bgColor: "bg-green-100" },
  { id: "2", name: "Compliance Report", description: "Monitor compliance training status", icon: <ShieldCheck className="h-6 w-6" />, color: "text-blue-600", bgColor: "bg-blue-100" },
  { id: "3", name: "Skills Gap Report", description: "Identify skill gaps across teams", icon: <BarChart3 className="h-6 w-6" />, color: "text-purple-600", bgColor: "bg-purple-100" },
  { id: "4", name: "Engagement Report", description: "Measure learner engagement metrics", icon: <TrendingUp className="h-6 w-6" />, color: "text-orange-600", bgColor: "bg-orange-100" },
  { id: "5", name: "Course Effectiveness", description: "Analyze course performance and ratings", icon: <Target className="h-6 w-6" />, color: "text-red-600", bgColor: "bg-red-100" },
  { id: "6", name: "Learner Progress", description: "Individual and team progress tracking", icon: <Users className="h-6 w-6" />, color: "text-primary-600", bgColor: "bg-primary-100" },
  { id: "7", name: "Compliance & Expiry", description: "Per-learner recert status: overdue, expiring, and compliant by name and date", icon: <ShieldCheck className="h-6 w-6" />, color: "text-amber-600", bgColor: "bg-amber-100" },
  { id: "8", name: "At-Risk Learners", description: "Overdue, inactive, and low-progress learners — with one-click reminders", icon: <AlertTriangle className="h-6 w-6" />, color: "text-rose-600", bgColor: "bg-rose-100" },
  { id: "9", name: "Training Matrix", description: "Every learner × required training with RAG status — grid view under the Training Matrix tab", icon: <Table className="h-6 w-6" />, color: "text-primary-600", bgColor: "bg-primary-100" },
];

export interface DatasetMeta {
  label: string;
  columns: Record<string, { label: string }>;
  filters: string[];
}

export interface ReportDefinition {
  id: string;
  name: string;
  description: string;
  dataset: string;
  columns: string[];
  filters: Record<string, string>;
  sort_by: string | null;
  sort_dir: string;
  updated_at: string;
}

export interface AtRiskRow {
  user_id: string;
  course_id: string;
  user_name: string;
  email: string;
  department: string;
  course_title: string;
  progress: number;
  due_date: string | null;
  days_overdue: number | null;
  days_since_last_access: number | null;
  never_accessed: string | null;
  risk_score: number;
  risk_level: string;
  recommended_action: string;
}

const reportFields = ["User Name", "Department", "Course", "Status", "Score", "Completion Date", "Time Spent", "Certificate"];

const fieldKeyMap: Record<string, keyof ReportRow> = {
  "User Name": "userName",
  "Department": "department",
  "Course": "course",
  "Status": "status",
  "Score": "score",
  "Completion Date": "completionDate",
  "Time Spent": "timeSpent",
  "Certificate": "certificate",
};

const exportCSV = (data: Record<string, unknown>[], filename: string) => {
  if (data.length === 0) return;
  const headers = Object.keys(data[0]).join(",");
  const rows = data.map(row => Object.values(row).map(v => `"${String(v).replace(/"/g, '""')}"`).join(","));
  const csv = [headers, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const exportPDF = (data: Record<string, unknown>[], title: string) => {
  if (data.length === 0) return;
  const headers = Object.keys(data[0]);
  const headerRow = headers.map(h => `<th style="border:1px solid #ddd;padding:8px;background:#f5f5f5;text-align:left">${escapeHtml(String(h))}</th>`).join("");
  const bodyRows = data.map(row =>
    `<tr>${Object.values(row).map(v => `<td style="border:1px solid #ddd;padding:8px">${escapeHtml(String(v))}</td>`).join("")}</tr>`
  ).join("");
  const safeTitle = escapeHtml(String(title));
  const html = `<!DOCTYPE html><html><head><title>${safeTitle}</title><style>body{font-family:Arial,sans-serif;margin:20px}table{border-collapse:collapse;width:100%}h1{color:#333}</style></head><body><h1>${safeTitle}</h1><p>Generated on ${new Date().toLocaleDateString()}</p><table><thead><tr>${headerRow}</tr></thead><tbody>${bodyRows}</tbody></table></body></html>`;
  const win = window.open("", "_blank");
  if (win) {
    win.document.write(html);
    win.document.close();
    win.print();
  }
};

const exportExcel = (data: Record<string, unknown>[], filename: string) => {
  // Export as CSV with .csv extension since a real Excel library is not available
  exportCSV(data, filename.replace(/\.\w+$/, "") + ".csv");
};

export default function ReportsClient({ reportData: initialReportData, recentReports, summary }: ReportsClientProps) {
  const toast = useToast();
  const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set(reportFields));
  const [atRiskRows, setAtRiskRows] = useState<AtRiskRow[]>([]);
  const [showAtRisk, setShowAtRisk] = useState(false);
  const [selectedAtRisk, setSelectedAtRisk] = useState<Set<string>>(new Set());
  const [nudging, setNudging] = useState(false);

  // Custom report builder
  const [datasets, setDatasets] = useState<Record<string, DatasetMeta>>({});
  const [definitions, setDefinitions] = useState<ReportDefinition[]>([]);
  const [orgs, setOrgs] = useState<{ id: string; name: string }[]>([]);
  const [builderDataset, setBuilderDataset] = useState("enrollments");
  const [builderCols, setBuilderCols] = useState<string[]>([]);
  const [builderFilters, setBuilderFilters] = useState<Record<string, string>>({});
  const [builderSortBy, setBuilderSortBy] = useState("");
  const [builderSortDir, setBuilderSortDir] = useState<"asc" | "desc">("asc");
  const [builderName, setBuilderName] = useState("");
  const [editingDefId, setEditingDefId] = useState<string | null>(null);
  const [customRows, setCustomRows] = useState<Record<string, unknown>[] | null>(null);
  const [customTitle, setCustomTitle] = useState("Custom Report");
  const [customBusy, setCustomBusy] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [department, setDepartment] = useState("All");
  const [showPreview, setShowPreview] = useState(false);
  const [reportData, setReportData] = useState<ReportRow[]>(initialReportData);
  const [loadingReport, setLoadingReport] = useState<string | null>(null);
  const [activeReportName, setActiveReportName] = useState("");
  const [viewingReport, setViewingReport] = useState<RecentReport | null>(null);
  const [viewerLoading, setViewerLoading] = useState(false);

  const getFilteredData = useCallback((): Record<string, unknown>[] => {
    return reportData.map(row => {
      const filtered: Record<string, unknown> = {};
      selectedFields.forEach(field => {
        const key = fieldKeyMap[field];
        if (key) filtered[field] = row[key];
      });
      return filtered;
    });
  }, [reportData, selectedFields]);

  const templateToReportType: Record<string, string> = {
    "Completion Report": "completion",
    "Compliance Report": "compliance",
    "Skills Gap Report": "skills_gap",
    "Engagement Report": "engagement",
    "Course Effectiveness": "course_effectiveness",
    "Learner Progress": "learner_progress",
    "Compliance & Expiry": "compliance_detail",
    "At-Risk Learners": "at_risk",
    "Training Matrix": "training_matrix",
  };

  const fetchReport = useCallback(async (templateName?: string) => {
    setLoadingReport(templateName || "__custom__");
    try {
      const reportType = templateName ? templateToReportType[templateName] || "completion" : "completion";

      const response = await fetch("/api/reports/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          report_type: reportType,
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
          department: department !== "All" ? department : undefined,
          format: "json",
        }),
      });
      const data = await response.json();

      if (response.ok && data?.rows && reportType === "at_risk") {
        setAtRiskRows(data.rows as AtRiskRow[]);
        setSelectedAtRisk(new Set());
        setActiveReportName(templateName || "At-Risk Learners");
        setShowAtRisk(true);
        setShowPreview(false);
        setCustomRows(null);
      } else if (response.ok && data?.rows) {
        // Map API rows to ReportRow format
        const mapped: ReportRow[] = data.rows.map((row: Record<string, any>) => ({
          userName: row.user_name || row.name || row.course_title || "-",
          department: row.department || "-",
          course: row.course_title || row.course || row.skill_name || "-",
          status: row.status || (row.compliance_rate != null ? `${row.compliance_rate}%` : "-"),
          score: row.score ?? row.avg_score ?? row.proficiency_level ?? 0,
          completionDate: row.completed_at ? new Date(row.completed_at).toISOString().split("T")[0] : row.assessed_at ? new Date(row.assessed_at).toISOString().split("T")[0] : "-",
          timeSpent: row.time_spent ? `${Math.round(row.time_spent / 60)}h` : row.total_hours ? `${row.total_hours}h` : row.avg_time_spent ? `${Math.round(row.avg_time_spent / 60)}h` : "-",
          certificate: row.status === "completed" ? "Yes" : "-",
        }));
        setReportData(mapped);
        setActiveReportName(templateName || "Custom Report");
        setShowPreview(true);
        setShowAtRisk(false);
        setCustomRows(null);
      } else {
        // Fallback: show initial data
        setActiveReportName(templateName || "Custom Report");
        setShowPreview(true);
      }
    } catch {
      setActiveReportName(templateName || "Custom Report");
      setShowPreview(true);
    } finally {
      setLoadingReport(null);
    }
  }, [dateFrom, dateTo, department]);

  const inferReportType = (name: string): string => {
    const lc = name.toLowerCase();
    if (lc.includes("risk")) return "at_risk";
    if (lc.includes("matrix")) return "training_matrix";
    if (lc.includes("compliance")) return "compliance";
    if (lc.includes("skill")) return "skills_gap";
    if (lc.includes("engagement")) return "engagement";
    if (lc.includes("effectiveness") || lc.includes("course")) return "course_effectiveness";
    if (lc.includes("progress") || lc.includes("learner")) return "learner_progress";
    return "completion";
  };

  const handleViewRecentReport = async (report: RecentReport) => {
    setViewerLoading(true);
    setViewingReport(report);
    try {
      const response = await fetch("/api/reports/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ report_type: inferReportType(report.name), format: "json" }),
      });
      const data = await response.json();
      if (response.ok && data?.rows) {
        const mapped: ReportRow[] = data.rows.map((row: Record<string, any>) => ({
          userName: row.user_name || row.name || row.course_title || "-",
          department: row.department || "-",
          course: row.course_title || row.course || row.skill_name || "-",
          status: row.status || (row.compliance_rate != null ? `${row.compliance_rate}%` : "-"),
          score: row.score ?? row.avg_score ?? row.proficiency_level ?? 0,
          completionDate: row.completed_at
            ? new Date(row.completed_at).toISOString().split("T")[0]
            : row.assessed_at
            ? new Date(row.assessed_at).toISOString().split("T")[0]
            : "-",
          timeSpent: row.time_spent
            ? `${Math.round(row.time_spent / 60)}h`
            : row.total_hours
            ? `${row.total_hours}h`
            : row.avg_time_spent
            ? `${Math.round(row.avg_time_spent / 60)}h`
            : "-",
          certificate: row.status === "completed" ? "Yes" : "-",
        }));
        setReportData(mapped);
      }
    } catch {
      // Fall back to currently loaded data
    } finally {
      setViewerLoading(false);
    }
  };

  const viewerColumns: ReportColumn<ReportRow>[] = [
    { key: "userName", label: "User Name" },
    { key: "department", label: "Department" },
    { key: "course", label: "Course" },
    { key: "status", label: "Status" },
    { key: "score", label: "Score", align: "right", render: (r) => (r.score > 0 ? `${r.score}%` : "—") },
    { key: "completionDate", label: "Completion Date" },
    { key: "timeSpent", label: "Time Spent", align: "right" },
    { key: "certificate", label: "Certificate", align: "center" },
  ];

  const handleDownloadRecentReport = (report: RecentReport) => {
    // Generate a CSV from the current report data as a proxy for stored reports
    const data = reportData.map(row => ({
      "User Name": row.userName,
      Department: row.department,
      Course: row.course,
      Status: row.status,
      Score: row.score,
      "Completion Date": row.completionDate,
      "Time Spent": row.timeSpent,
      Certificate: row.certificate,
    }));
    exportCSV(data, `${report.name.replace(/\s+/g, "_")}_${report.generatedDate}.csv`);
  };

  const atRiskKey = (row: AtRiskRow) => `${row.user_id}:${row.course_id}`;

  const toggleAtRiskRow = (row: AtRiskRow) => {
    setSelectedAtRisk((prev) => {
      const next = new Set(prev);
      const key = atRiskKey(row);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const sendReminders = async (rows: AtRiskRow[]) => {
    if (rows.length === 0) return;
    setNudging(true);
    try {
      const res = await fetch("/api/reports/at-risk/nudge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targets: rows.map((r) => ({ user_id: r.user_id, course_id: r.course_id })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to send reminders");
      const skippedNote = data.skipped > 0 ? ` (${data.skipped} skipped — already reminded in the last 24h or no longer at risk)` : "";
      toast.success(`Sent ${data.sent} reminder${data.sent === 1 ? "" : "s"}${skippedNote}.`);
      setSelectedAtRisk(new Set());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send reminders");
    } finally {
      setNudging(false);
    }
  };

  const riskBadge = (level: string) => {
    switch (level) {
      case "critical": return "bg-red-100 text-red-700";
      case "high": return "bg-orange-100 text-orange-700";
      case "medium": return "bg-amber-100 text-amber-700";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  const atRiskCsvRows = () =>
    atRiskRows.map((r) => ({
      "User Name": r.user_name,
      Email: r.email,
      Department: r.department,
      Course: r.course_title,
      "Progress %": r.progress,
      "Due Date": r.due_date ?? "-",
      "Days Overdue": r.days_overdue ?? "-",
      "Days Since Last Access": r.never_accessed ? "Never accessed" : r.days_since_last_access ?? "-",
      "Risk Score": r.risk_score,
      "Risk Level": r.risk_level,
      "Recommended Action": r.recommended_action,
    }));

  useEffect(() => {
    fetch("/api/reports/definitions")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setDefinitions(d.definitions ?? []);
        setDatasets(d.datasets ?? {});
        const first = d.datasets?.enrollments ? "enrollments" : Object.keys(d.datasets ?? {})[0];
        if (first) {
          setBuilderDataset(first);
          setBuilderCols(Object.keys(d.datasets[first]?.columns ?? {}));
        }
      })
      .catch(() => {});
    fetch("/api/organizations")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (Array.isArray(d)) setOrgs(d.map((o: any) => ({ id: o.id, name: o.name })));
      })
      .catch(() => {});
  }, []);

  const selectBuilderDataset = (ds: string) => {
    setBuilderDataset(ds);
    setBuilderCols(Object.keys(datasets[ds]?.columns ?? {}));
    setBuilderSortBy("");
    setBuilderFilters({});
  };

  const toggleBuilderCol = (col: string) =>
    setBuilderCols((prev) =>
      prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col]
    );

  // Columns always projected in registry order regardless of click order.
  const builderSpec = () => {
    const meta = datasets[builderDataset];
    const columns = Object.keys(meta?.columns ?? {}).filter((c) => builderCols.includes(c));
    const filters: Record<string, string> = {};
    for (const key of meta?.filters ?? []) {
      if (builderFilters[key]) filters[key] = builderFilters[key];
    }
    return {
      dataset: builderDataset,
      columns,
      filters,
      sort_by: builderSortBy && columns.includes(builderSortBy) ? builderSortBy : null,
      sort_dir: builderSortDir,
    };
  };

  const previewCustom = async () => {
    setCustomBusy("preview");
    try {
      const res = await fetch("/api/reports/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ custom: builderSpec(), format: "json" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to run report");
      setCustomRows(data.rows ?? []);
      setCustomTitle(builderName.trim() || "Custom Report (preview)");
      setShowAtRisk(false);
      setShowPreview(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to run report");
    } finally {
      setCustomBusy(null);
    }
  };

  const refreshDefinitions = async () => {
    try {
      const res = await fetch("/api/reports/definitions");
      if (!res.ok) return;
      const d = await res.json();
      setDefinitions(d.definitions ?? []);
    } catch {
      // keep current list
    }
  };

  const saveDefinition = async () => {
    const name = builderName.trim();
    if (!name) {
      toast.error("Give the report a name before saving");
      return;
    }
    setCustomBusy("save");
    try {
      const url = editingDefId
        ? `/api/reports/definitions/${editingDefId}`
        : "/api/reports/definitions";
      const res = await fetch(url, {
        method: editingDefId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, ...builderSpec() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to save report");
      toast.success(editingDefId ? `Updated "${name}".` : `Saved "${name}".`);
      setEditingDefId(null);
      setBuilderName("");
      await refreshDefinitions();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save report");
    } finally {
      setCustomBusy(null);
    }
  };

  const runDefinition = async (def: ReportDefinition) => {
    setCustomBusy(`run:${def.id}`);
    try {
      const res = await fetch("/api/reports/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ definition_id: def.id, format: "json" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to run report");
      setCustomRows(data.rows ?? []);
      setCustomTitle(def.name);
      setShowAtRisk(false);
      setShowPreview(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to run report");
    } finally {
      setCustomBusy(null);
    }
  };

  const downloadDefinition = async (def: ReportDefinition) => {
    setCustomBusy(`csv:${def.id}`);
    try {
      const res = await fetch("/api/reports/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ definition_id: def.id, format: "csv" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to export report");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${def.name.replace(/\s+/g, "_")}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to export report");
    } finally {
      setCustomBusy(null);
    }
  };

  const editDefinition = (def: ReportDefinition) => {
    setEditingDefId(def.id);
    setBuilderName(def.name);
    setBuilderDataset(def.dataset);
    setBuilderCols(def.columns);
    setBuilderFilters(def.filters ?? {});
    setBuilderSortBy(def.sort_by ?? "");
    setBuilderSortDir(def.sort_dir === "desc" ? "desc" : "asc");
  };

  const deleteDefinition = async (def: ReportDefinition) => {
    setCustomBusy(`delete:${def.id}`);
    try {
      const res = await fetch(`/api/reports/definitions/${def.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to delete report");
      }
      toast.success(`Deleted "${def.name}".`);
      if (editingDefId === def.id) {
        setEditingDefId(null);
        setBuilderName("");
      }
      setDefinitions((prev) => prev.filter((d) => d.id !== def.id));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete report");
    } finally {
      setCustomBusy(null);
    }
  };

  const builderMeta = datasets[builderDataset];

  const toggleField = (field: string) => {
    setSelectedFields((prev) => {
      const next = new Set(prev);
      if (next.has(field)) next.delete(field);
      else next.add(field);
      return next;
    });
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "Completed": return "bg-green-100 text-green-700";
      case "In Progress": return "bg-blue-100 text-blue-700";
      case "Overdue": return "bg-red-100 text-red-700";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  return (
    <div className="space-y-8">
      <AdminAnalyticsTabs />
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
        <p className="mt-1 text-sm text-gray-500">Generate and export comprehensive learning reports</p>
      </div>

      <div>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-gray-900">Report Templates</h2>
          <div className="flex flex-wrap items-center gap-2">
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} aria-label="From date" className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500" />
            <span className="text-sm text-gray-500">to</span>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} aria-label="To date" className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500" />
            <select value={department} onChange={(e) => setDepartment(e.target.value)} aria-label="Department" className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500">
              <option value="All">All Departments</option>
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {reportTemplates.map((template) => (
            <div key={template.id} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className={cn("inline-flex rounded-lg p-2.5", template.bgColor)}>
                <span className={template.color}>{template.icon}</span>
              </div>
              <h3 className="mt-3 font-semibold text-gray-900">{template.name}</h3>
              <p className="mt-1 text-sm text-gray-500">{template.description}</p>
              <button onClick={() => fetchReport(template.name)} disabled={loadingReport !== null} className="mt-4 w-full rounded-lg border border-primary-200 bg-primary-50 px-4 py-2 text-sm font-medium text-primary-700 hover:bg-primary-100 transition-colors disabled:opacity-50">
                {loadingReport === template.name ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Generate"}
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-5">
          <Filter className="h-5 w-5 text-primary-600" />
          <h2 className="text-lg font-semibold text-gray-900">Custom Report Builder</h2>
          {editingDefId && (
            <span className="ml-2 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
              Editing saved report
            </span>
          )}
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Dataset</label>
              <select
                value={builderDataset}
                onChange={(e) => selectBuilderDataset(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              >
                {Object.entries(datasets).map(([key, meta]) => (
                  <option key={key} value={key}>{meta.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Columns</label>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(builderMeta?.columns ?? {}).map(([key, col]) => (
                  <label key={key} className="flex items-center gap-2 rounded-lg border border-gray-200 p-2.5 cursor-pointer hover:bg-gray-50 transition-colors">
                    <input
                      type="checkbox"
                      checked={builderCols.includes(key)}
                      onChange={() => toggleBuilderCol(key)}
                      className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-700">{col.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <div className="space-y-4">
            {builderMeta?.filters.includes("date_from") && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Enrolled Between</label>
                <div className="flex items-center gap-3">
                  <input type="date" value={builderFilters.date_from ?? ""} onChange={(e) => setBuilderFilters((f) => ({ ...f, date_from: e.target.value }))} className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500" />
                  <span className="text-sm text-gray-500">to</span>
                  <input type="date" value={builderFilters.date_to ?? ""} onChange={(e) => setBuilderFilters((f) => ({ ...f, date_to: e.target.value }))} className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500" />
                </div>
              </div>
            )}
            {builderMeta?.filters.includes("department") && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Department</label>
                <select
                  value={builderFilters.department ?? ""}
                  onChange={(e) => setBuilderFilters((f) => ({ ...f, department: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                >
                  <option value="">All Departments</option>
                  {orgs.map((o) => (
                    <option key={o.id} value={o.id}>{o.name}</option>
                  ))}
                </select>
              </div>
            )}
            {builderMeta?.filters.includes("status") && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Enrollment Status</label>
                <select
                  value={builderFilters.status ?? ""}
                  onChange={(e) => setBuilderFilters((f) => ({ ...f, status: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                >
                  <option value="">Any Status</option>
                  <option value="enrolled">Enrolled</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="failed">Failed</option>
                  <option value="expired">Expired</option>
                </select>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Sort By</label>
              <div className="flex items-center gap-2">
                <select
                  value={builderSortBy}
                  onChange={(e) => setBuilderSortBy(e.target.value)}
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                >
                  <option value="">Default order</option>
                  {builderCols.map((key) => (
                    <option key={key} value={key}>{builderMeta?.columns[key]?.label ?? key}</option>
                  ))}
                </select>
                <select
                  value={builderSortDir}
                  onChange={(e) => setBuilderSortDir(e.target.value === "desc" ? "desc" : "asc")}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  aria-label="Sort direction"
                >
                  <option value="asc">Ascending</option>
                  <option value="desc">Descending</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Report Name</label>
              <input
                type="text"
                value={builderName}
                onChange={(e) => setBuilderName(e.target.value)}
                placeholder="e.g. Q3 Compliance Enrollments"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={previewCustom}
                disabled={customBusy !== null || builderCols.length === 0}
                className="flex-1 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700 transition-colors disabled:opacity-50"
              >
                {customBusy === "preview" ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Run Report"}
              </button>
              <button
                onClick={saveDefinition}
                disabled={customBusy !== null || builderCols.length === 0}
                className="flex-1 rounded-lg border border-primary-200 bg-primary-50 px-4 py-2.5 text-sm font-medium text-primary-700 hover:bg-primary-100 transition-colors disabled:opacity-50"
              >
                {customBusy === "save" ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : editingDefId ? "Update Saved Report" : "Save Report"}
              </button>
              {editingDefId && (
                <button
                  onClick={() => { setEditingDefId(null); setBuilderName(""); }}
                  className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        </div>

        {definitions.length > 0 && (
          <div className="mt-6 border-t border-gray-100 pt-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Saved Reports</h3>
            <div className="divide-y divide-gray-100">
              {definitions.map((def) => (
                <div key={def.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{def.name}</p>
                    <p className="text-xs text-gray-500">
                      {datasets[def.dataset]?.label ?? def.dataset} · {def.columns.length} column{def.columns.length === 1 ? "" : "s"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => runDefinition(def)} disabled={customBusy !== null} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50">
                      {customBusy === `run:${def.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
                      Run
                    </button>
                    <button onClick={() => downloadDefinition(def)} disabled={customBusy !== null} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50">
                      {customBusy === `csv:${def.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                      CSV
                    </button>
                    <button onClick={() => editDefinition(def)} disabled={customBusy !== null} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50">
                      Edit
                    </button>
                    <button onClick={() => deleteDefinition(def)} disabled={customBusy !== null} className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50">
                      {customBusy === `delete:${def.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Delete"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {customRows !== null && (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-6 py-4">
            <div className="flex items-center gap-2">
              <Table className="h-5 w-5 text-primary-600" />
              <h2 className="text-lg font-semibold text-gray-900">{customTitle}</h2>
              <span className="ml-2 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">{customRows.length} rows</span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => exportCSV(customRows, `${customTitle.replace(/\s+/g, "_")}.csv`)} disabled={customRows.length === 0} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50">
                <Download className="h-3.5 w-3.5" />
                CSV
              </button>
              <button onClick={() => exportPDF(customRows, customTitle)} disabled={customRows.length === 0} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50">
                <Download className="h-3.5 w-3.5" />
                PDF
              </button>
            </div>
          </div>
          {customRows.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-gray-500">No rows match this report&apos;s filters.</p>
          ) : (
            <div className="overflow-x-auto">
              <UITable>
                <TableHeader>
                  <TableRow>
                    {Object.keys(customRows[0]).map((key) => (
                      <TableHead key={key}>{key}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customRows.map((row, idx) => (
                    <TableRow key={idx}>
                      {Object.keys(customRows[0]).map((key) => (
                        <TableCell key={key} className="text-sm text-gray-700">
                          {row[key] === null || row[key] === undefined || row[key] === "" ? "—" : String(row[key])}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </UITable>
            </div>
          )}
        </div>
      )}

      {showAtRisk && (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-6 py-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-rose-600" />
              <h2 className="text-lg font-semibold text-gray-900">At-Risk Learners</h2>
              <span className="ml-2 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">{atRiskRows.length} rows</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => sendReminders(atRiskRows.filter((r) => selectedAtRisk.has(atRiskKey(r))))}
                disabled={nudging || selectedAtRisk.size === 0}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700 transition-colors disabled:opacity-50"
              >
                {nudging ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BellRing className="h-3.5 w-3.5" />}
                Remind selected ({selectedAtRisk.size})
              </button>
              <button onClick={() => exportCSV(atRiskCsvRows(), "At-Risk_Learners_report.csv")} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                <Download className="h-3.5 w-3.5" />
                CSV
              </button>
              <button onClick={() => exportPDF(atRiskCsvRows(), "At-Risk Learners Report")} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                <Download className="h-3.5 w-3.5" />
                PDF
              </button>
            </div>
          </div>
          {atRiskRows.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-gray-500">
              No at-risk learners found — nobody in the selected scope is overdue, inactive, or behind on progress.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <UITable>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <input
                        type="checkbox"
                        aria-label="Select all at-risk learners"
                        checked={selectedAtRisk.size === atRiskRows.length && atRiskRows.length > 0}
                        onChange={() =>
                          setSelectedAtRisk(
                            selectedAtRisk.size === atRiskRows.length
                              ? new Set()
                              : new Set(atRiskRows.map(atRiskKey))
                          )
                        }
                        className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                    </TableHead>
                    <TableHead>Learner</TableHead>
                    <TableHead>Course</TableHead>
                    <TableHead>Risk</TableHead>
                    <TableHead className="text-right">Progress</TableHead>
                    <TableHead>Due</TableHead>
                    <TableHead>Last Access</TableHead>
                    <TableHead>Recommended Action</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {atRiskRows.map((row) => (
                    <TableRow key={atRiskKey(row)}>
                      <TableCell>
                        <input
                          type="checkbox"
                          aria-label={`Select ${row.user_name}`}
                          checked={selectedAtRisk.has(atRiskKey(row))}
                          onChange={() => toggleAtRiskRow(row)}
                          className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                        />
                      </TableCell>
                      <TableCell>
                        <p className="text-sm font-medium text-gray-900">{row.user_name}</p>
                        <p className="text-xs text-gray-500">{row.department}</p>
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">{row.course_title}</TableCell>
                      <TableCell>
                        <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium", riskBadge(row.risk_level))}>
                          {row.risk_level} · {row.risk_score}
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-sm text-gray-600">{row.progress}%</TableCell>
                      <TableCell className="text-sm">
                        {row.days_overdue ? (
                          <span className="font-medium text-red-600">{row.days_overdue}d overdue</span>
                        ) : (
                          <span className="text-gray-600">{row.due_date ?? "—"}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {row.never_accessed ? "Never" : row.days_since_last_access != null ? `${row.days_since_last_access}d ago` : "—"}
                      </TableCell>
                      <TableCell className="max-w-xs text-sm text-gray-600">{row.recommended_action}</TableCell>
                      <TableCell className="text-right">
                        <button
                          onClick={() => sendReminders([row])}
                          disabled={nudging}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
                        >
                          <BellRing className="h-3.5 w-3.5" />
                          Remind
                        </button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </UITable>
            </div>
          )}
        </div>
      )}

      {showPreview && (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
            <div className="flex items-center gap-2">
              <Table className="h-5 w-5 text-primary-600" />
              <h2 className="text-lg font-semibold text-gray-900">Report Preview</h2>
              <span className="ml-2 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">{reportData.length} rows</span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => exportCSV(getFilteredData(), `${activeReportName.replace(/\s+/g, "_")}_report.csv`)} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                <Download className="h-3.5 w-3.5" />
                CSV
              </button>
              <button onClick={() => exportPDF(getFilteredData(), `${activeReportName} Report`)} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                <Download className="h-3.5 w-3.5" />
                PDF
              </button>
              <button onClick={() => exportExcel(getFilteredData(), `${activeReportName.replace(/\s+/g, "_")}_report.csv`)} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors" title="Downloads as CSV format, compatible with Excel">
                <Download className="h-3.5 w-3.5" />
                CSV (Excel)
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  {reportFields.filter(f => selectedFields.size === 0 || selectedFields.has(f)).map((field) => (
                    <th key={field} className={cn("px-6 py-3 text-xs font-medium uppercase tracking-wider text-gray-500", field === "Score" || field === "Certificate" ? "text-center" : "text-left")}>{field}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {reportData.map((row, idx) => (
                  <tr key={idx} className="hover:bg-gray-50 transition-colors">
                    {(selectedFields.size === 0 || selectedFields.has("User Name")) && <td className="px-6 py-3 text-sm font-medium text-gray-900">{row.userName}</td>}
                    {(selectedFields.size === 0 || selectedFields.has("Department")) && <td className="px-6 py-3 text-sm text-gray-600">{row.department}</td>}
                    {(selectedFields.size === 0 || selectedFields.has("Course")) && <td className="px-6 py-3 text-sm text-gray-600">{row.course}</td>}
                    {(selectedFields.size === 0 || selectedFields.has("Status")) && <td className="px-6 py-3"><span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium", statusColor(row.status))}>{row.status}</span></td>}
                    {(selectedFields.size === 0 || selectedFields.has("Score")) && <td className="px-6 py-3 text-center text-sm font-medium text-gray-900">{row.score > 0 ? `${row.score}%` : "-"}</td>}
                    {(selectedFields.size === 0 || selectedFields.has("Completion Date")) && <td className="px-6 py-3 text-sm text-gray-600">{row.completionDate}</td>}
                    {(selectedFields.size === 0 || selectedFields.has("Time Spent")) && <td className="px-6 py-3 text-sm text-gray-600">{row.timeSpent}</td>}
                    {(selectedFields.size === 0 || selectedFields.has("Certificate")) && <td className="px-6 py-3 text-center">{row.certificate === "Yes" ? <CheckCircle className="mx-auto h-4 w-4 text-green-500" /> : <span className="text-sm text-gray-500">-</span>}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Recent Reports</h2>
        </div>
        <div className="divide-y divide-gray-100">
          {recentReports.map((report) => (
            <div key={report.id} className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100">
                  <FileText className="h-5 w-5 text-gray-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{report.name}</p>
                  <p className="text-xs text-gray-500">Generated on {report.generatedDate} by {report.generatedBy}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-500">{report.rowCount.toLocaleString()} rows</span>
                <button onClick={() => handleViewRecentReport(report)} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                  <Eye className="h-3.5 w-3.5" />
                  View
                </button>
                <button onClick={() => handleDownloadRecentReport(report)} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                  <Download className="h-3.5 w-3.5" />
                  Download
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <ReportViewerModal
        open={viewingReport !== null}
        onClose={() => setViewingReport(null)}
        title={viewingReport?.name ?? "Report"}
        subtitle={
          viewingReport
            ? `Generated ${viewingReport.generatedDate} by ${viewingReport.generatedBy}${viewerLoading ? " · Loading…" : ""}`
            : undefined
        }
        rows={reportData as unknown as Record<string, unknown>[]}
        columns={viewerColumns as unknown as ReportColumn<Record<string, unknown>>[]}
      />
    </div>
  );
}
