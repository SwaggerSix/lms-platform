"use client";

import { useState, useCallback } from "react";
import {
  CheckCircle,
  ShieldCheck,
  BarChart3,
  TrendingUp,
  Target,
  Users,
  Download,
  FileText,
  Filter,
  Table,
  Loader2,
} from "lucide-react";
import { cn } from "@/utils/cn";

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
  { id: "6", name: "Learner Progress", description: "Individual and team progress tracking", icon: <Users className="h-6 w-6" />, color: "text-indigo-600", bgColor: "bg-indigo-100" },
];

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

const exportPDF = (data: Record<string, unknown>[], title: string) => {
  if (data.length === 0) return;
  const headers = Object.keys(data[0]);
  const headerRow = headers.map(h => `<th style="border:1px solid #ddd;padding:8px;background:#f5f5f5;text-align:left">${h}</th>`).join("");
  const bodyRows = data.map(row =>
    `<tr>${Object.values(row).map(v => `<td style="border:1px solid #ddd;padding:8px">${String(v)}</td>`).join("")}</tr>`
  ).join("");
  const html = `<!DOCTYPE html><html><head><title>${title}</title><style>body{font-family:Arial,sans-serif;margin:20px}table{border-collapse:collapse;width:100%}h1{color:#333}</style></head><body><h1>${title}</h1><p>Generated on ${new Date().toLocaleDateString()}</p><table><thead><tr>${headerRow}</tr></thead><tbody>${bodyRows}</tbody></table></body></html>`;
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
  const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set(reportFields));
  const [dateFrom, setDateFrom] = useState("2026-03-01");
  const [dateTo, setDateTo] = useState("2026-03-16");
  const [department, setDepartment] = useState("All");
  const [role, setRole] = useState("All");
  const [showPreview, setShowPreview] = useState(false);
  const [reportData, setReportData] = useState<ReportRow[]>(initialReportData);
  const [loading, setLoading] = useState(false);
  const [activeReportName, setActiveReportName] = useState("");

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

  const fetchReport = useCallback(async (templateName?: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        metric: "overview",
      });
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      if (department !== "All") params.set("department", department);
      if (role !== "All") params.set("role", role);
      if (templateName) params.set("template", templateName);

      const response = await fetch(`/api/analytics?${params.toString()}`);
      const data = await response.json();

      if (response.ok && data) {
        // If the API returns report rows, use them; otherwise keep the initial data
        if (Array.isArray(data.rows)) {
          setReportData(data.rows);
        }
        // Use the data we have (initial props or fetched)
        setActiveReportName(templateName || "Custom Report");
        setShowPreview(true);
      } else {
        // Fallback: show the initial data passed via props
        setActiveReportName(templateName || "Custom Report");
        setShowPreview(true);
      }
    } catch {
      // On network error, still show preview with available data
      setActiveReportName(templateName || "Custom Report");
      setShowPreview(true);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, department, role]);

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
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
        <p className="mt-1 text-sm text-gray-500">Generate and export comprehensive learning reports</p>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Report Templates</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {reportTemplates.map((template) => (
            <div key={template.id} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className={cn("inline-flex rounded-lg p-2.5", template.bgColor)}>
                <span className={template.color}>{template.icon}</span>
              </div>
              <h3 className="mt-3 font-semibold text-gray-900">{template.name}</h3>
              <p className="mt-1 text-sm text-gray-500">{template.description}</p>
              <button onClick={() => fetchReport(template.name)} disabled={loading} className="mt-4 w-full rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100 transition-colors disabled:opacity-50">
                {loading ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Generate"}
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-5">
          <Filter className="h-5 w-5 text-indigo-600" />
          <h2 className="text-lg font-semibold text-gray-900">Custom Report Builder</h2>
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">Select Fields</label>
            <div className="grid grid-cols-2 gap-2">
              {reportFields.map((field) => (
                <label key={field} className="flex items-center gap-2 rounded-lg border border-gray-200 p-2.5 cursor-pointer hover:bg-gray-50 transition-colors">
                  <input type="checkbox" checked={selectedFields.has(field)} onChange={() => toggleField(field)} className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                  <span className="text-sm text-gray-700">{field}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Date Range</label>
              <div className="flex items-center gap-3">
                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                <span className="text-sm text-gray-500">to</span>
                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Department</label>
              <select value={department} onChange={(e) => setDepartment(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500">
                <option value="All">All Departments</option>
                <option value="Engineering">Engineering</option>
                <option value="Marketing">Marketing</option>
                <option value="Sales">Sales</option>
                <option value="HR">HR</option>
                <option value="Finance">Finance</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
              <select value={role} onChange={(e) => setRole(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500">
                <option value="All">All Roles</option>
                <option value="Employee">Employee</option>
                <option value="Manager">Manager</option>
                <option value="Admin">Admin</option>
              </select>
            </div>
            <button onClick={() => fetchReport()} disabled={loading} className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 transition-colors disabled:opacity-50">
              {loading ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Generate Custom Report"}
            </button>
          </div>
        </div>
      </div>

      {showPreview && (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
            <div className="flex items-center gap-2">
              <Table className="h-5 w-5 text-indigo-600" />
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
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">User Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Department</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Course</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Status</th>
                  <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">Score</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Completion Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Time Spent</th>
                  <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">Certificate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {reportData.map((row, idx) => (
                  <tr key={idx} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-3 text-sm font-medium text-gray-900">{row.userName}</td>
                    <td className="px-6 py-3 text-sm text-gray-600">{row.department}</td>
                    <td className="px-6 py-3 text-sm text-gray-600">{row.course}</td>
                    <td className="px-6 py-3">
                      <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium", statusColor(row.status))}>{row.status}</span>
                    </td>
                    <td className="px-6 py-3 text-center text-sm font-medium text-gray-900">{row.score > 0 ? `${row.score}%` : "-"}</td>
                    <td className="px-6 py-3 text-sm text-gray-600">{row.completionDate}</td>
                    <td className="px-6 py-3 text-sm text-gray-600">{row.timeSpent}</td>
                    <td className="px-6 py-3 text-center">
                      {row.certificate === "Yes" ? <CheckCircle className="mx-auto h-4 w-4 text-green-500" /> : <span className="text-sm text-gray-500">-</span>}
                    </td>
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
                <button onClick={() => handleDownloadRecentReport(report)} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                  <Download className="h-3.5 w-3.5" />
                  Download
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
