"use client";

import { useState, useMemo } from "react";
import {
  Printer,
  Download,
  FileText,
  CheckCircle2,
  Clock,
  XCircle,
  Award,
  ShieldCheck,
  ExternalLink,
  ChevronUp,
  ChevronDown,
  Filter,
  GraduationCap,
  BookOpen,
} from "lucide-react";
import { cn } from "@/utils/cn";
import { formatDate } from "@/utils/format";
import type { CourseType, EnrollmentStatus } from "@/types/database";

export interface TranscriptRecord {
  id: string;
  course_title: string;
  course_type: CourseType;
  enrollment_date: string;
  completion_date: string | null;
  status: EnrollmentStatus;
  score: number | null;
  credits: number;
  certificate_id: string | null;
}

export interface TranscriptUser {
  name: string;
  employee_id: string;
  department: string;
  job_title: string;
  manager: string;
  email: string;
  hire_date: string;
}

export interface TranscriptPageProps {
  user: TranscriptUser;
  records: TranscriptRecord[];
}

const COURSE_TYPE_CONFIG: Record<CourseType, { label: string; color: string }> = {
  self_paced: { label: "Self-Paced", color: "bg-blue-100 text-blue-700" },
  instructor_led: { label: "Instructor-Led", color: "bg-purple-100 text-purple-700" },
  blended: { label: "Blended", color: "bg-teal-100 text-teal-700" },
  scorm: { label: "SCORM", color: "bg-orange-100 text-orange-700" },
  external: { label: "External", color: "bg-gray-100 text-gray-700" },
};

type SortField = "course_title" | "enrollment_date" | "completion_date" | "status" | "score" | "credits";
type SortDirection = "asc" | "desc";

function getYear(dateStr: string): number {
  return new Date(dateStr).getFullYear();
}

export default function TranscriptClient({ user, records }: TranscriptPageProps) {
  const [statusFilter, setStatusFilter] = useState<"all" | "completed" | "in_progress">("all");
  const [typeFilter, setTypeFilter] = useState<CourseType | "all">("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortField, setSortField] = useState<SortField>("enrollment_date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const filtered = useMemo(() => {
    let entries = [...records];

    if (statusFilter !== "all") {
      entries = entries.filter((e) => e.status === statusFilter);
    }
    if (typeFilter !== "all") {
      entries = entries.filter((e) => e.course_type === typeFilter);
    }
    if (dateFrom) {
      entries = entries.filter((e) => e.enrollment_date >= dateFrom);
    }
    if (dateTo) {
      entries = entries.filter((e) => e.enrollment_date <= dateTo);
    }

    entries.sort((a, b) => {
      let aVal: string | number = "";
      let bVal: string | number = "";

      switch (sortField) {
        case "course_title":
          aVal = a.course_title;
          bVal = b.course_title;
          break;
        case "enrollment_date":
          aVal = a.enrollment_date;
          bVal = b.enrollment_date;
          break;
        case "completion_date":
          aVal = a.completion_date || "";
          bVal = b.completion_date || "";
          break;
        case "status":
          aVal = a.status;
          bVal = b.status;
          break;
        case "score":
          aVal = a.score ?? -1;
          bVal = b.score ?? -1;
          break;
        case "credits":
          aVal = a.credits;
          bVal = b.credits;
          break;
      }

      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });

    return entries;
  }, [records, statusFilter, typeFilter, dateFrom, dateTo, sortField, sortDirection]);

  const grouped = useMemo(() => {
    const groups: Record<number, TranscriptRecord[]> = {};
    for (const entry of filtered) {
      const year = getYear(entry.enrollment_date);
      if (!groups[year]) groups[year] = [];
      groups[year].push(entry);
    }
    return Object.entries(groups)
      .sort(([a], [b]) => Number(b) - Number(a))
      .map(([year, entries]) => ({ year: Number(year), entries }));
  }, [filtered]);

  const stats = useMemo(() => {
    const completed = records.filter((e) => e.status === "completed");
    const totalHours = completed.reduce((sum, e) => sum + e.credits, 0);
    const activeCerts = records.filter((e) => e.certificate_id && e.status === "completed").length;
    const complianceCourses = records.filter(
      (e) => e.course_type === "scorm" && e.status === "completed"
    );
    return {
      completedCount: completed.length,
      totalHours,
      activeCerts,
      complianceComplete: complianceCourses.length,
    };
  }, [records]);

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return <ChevronUp className="ml-1 inline h-3 w-3 text-gray-300" />;
    return sortDirection === "asc" ? (
      <ChevronUp className="ml-1 inline h-3 w-3 text-indigo-600" />
    ) : (
      <ChevronDown className="ml-1 inline h-3 w-3 text-indigo-600" />
    );
  }

  function StatusBadge({ status }: { status: EnrollmentStatus }) {
    switch (status) {
      case "completed":
        return (
          <span className="inline-flex items-center gap-1 text-green-700">
            <CheckCircle2 className="h-4 w-4" /> Completed
          </span>
        );
      case "in_progress":
        return (
          <span className="inline-flex items-center gap-1 text-yellow-700">
            <Clock className="h-4 w-4" /> In Progress
          </span>
        );
      case "failed":
        return (
          <span className="inline-flex items-center gap-1 text-red-700">
            <XCircle className="h-4 w-4" /> Failed
          </span>
        );
      default:
        return <span className="text-gray-500">{status}</span>;
    }
  }

  return (
    <>
      {/* Print styles */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #transcript-printable, #transcript-printable * { visibility: visible; }
          #transcript-printable { position: absolute; top: 0; left: 0; width: 100%; }
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          table { font-size: 10pt; }
          th, td { padding: 4px 8px !important; }
          .print-header { display: flex !important; }
        }
      `}</style>

      <div className="min-h-screen bg-gray-50">
        <div id="transcript-printable" className="mx-auto max-w-7xl px-6 py-8">
          {/* Print-only formal header */}
          <div className="print-only hidden mb-8 border-b-2 border-gray-900 pb-4 print-header items-center justify-between">
            <div>
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded bg-gray-300 flex items-center justify-center text-xs text-gray-600 font-bold">LOGO</div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">Official Training Transcript</h1>
                  <p className="text-sm text-gray-600">Acme Corporation Learning & Development</p>
                </div>
              </div>
            </div>
            <div className="text-right text-sm text-gray-600">
              <p>Generated: {new Date().toLocaleDateString()}</p>
              <p>Document ID: TR-{user.employee_id}</p>
            </div>
          </div>

          {/* Screen header */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Training Transcript</h1>
              <p className="mt-1 text-gray-500">Official record of all training activities and completions.</p>
            </div>
            <div className="no-print flex items-center gap-2">
              <button
                onClick={() => window.print()}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <Printer className="h-4 w-4" /> Print
              </button>
              <button className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                <Download className="h-4 w-4" /> Export PDF
              </button>
              <button className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                <FileText className="h-4 w-4" /> Export CSV
              </button>
            </div>
          </div>

          {/* User Info Card */}
          <div className="mt-6 rounded-xl border border-gray-200 bg-white p-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <p className="text-xs font-medium uppercase text-gray-500">Name</p>
                <p className="mt-1 font-semibold text-gray-900">{user.name}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-gray-500">Employee ID</p>
                <p className="mt-1 font-semibold text-gray-900">{user.employee_id}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-gray-500">Department</p>
                <p className="mt-1 font-semibold text-gray-900">{user.department}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-gray-500">Job Title</p>
                <p className="mt-1 font-semibold text-gray-900">{user.job_title}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-gray-500">Manager</p>
                <p className="mt-1 font-semibold text-gray-900">{user.manager}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-gray-500">Hire Date</p>
                <p className="mt-1 font-semibold text-gray-900">{formatDate(user.hire_date)}</p>
              </div>
            </div>
          </div>

          {/* Summary Stats */}
          <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100">
                  <GraduationCap className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{stats.completedCount}</p>
                  <p className="text-xs text-gray-500">Courses Completed</p>
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                  <BookOpen className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalHours}</p>
                  <p className="text-xs text-gray-500">Total Credits/Hours</p>
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100">
                  <Award className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{stats.activeCerts}</p>
                  <p className="text-xs text-gray-500">Active Certifications</p>
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100">
                  <ShieldCheck className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{stats.complianceComplete}/{stats.complianceComplete}</p>
                  <p className="text-xs text-gray-500">Compliance Complete</p>
                </div>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="no-print mt-6 flex flex-wrap items-end gap-4 rounded-xl border border-gray-200 bg-white p-4">
            <Filter className="h-5 w-5 text-gray-400" />
            <div>
              <label className="block text-xs font-medium text-gray-500">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as "all" | "completed" | "in_progress")}
                className="mt-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="all">All Statuses</option>
                <option value="completed">Completed</option>
                <option value="in_progress">In Progress</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500">Course Type</label>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as CourseType | "all")}
                className="mt-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="all">All Types</option>
                <option value="self_paced">Self-Paced</option>
                <option value="instructor_led">Instructor-Led</option>
                <option value="blended">Blended</option>
                <option value="scorm">SCORM</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500">From Date</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="mt-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500">To Date</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="mt-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            {(statusFilter !== "all" || typeFilter !== "all" || dateFrom || dateTo) && (
              <button
                onClick={() => {
                  setStatusFilter("all");
                  setTypeFilter("all");
                  setDateFrom("");
                  setDateTo("");
                }}
                className="text-sm text-indigo-600 hover:text-indigo-800"
              >
                Clear filters
              </button>
            )}
          </div>

          {/* Transcript Table grouped by year */}
          <div className="mt-6">
            {grouped.map(({ year, entries }) => {
              const yearCompleted = entries.filter((e) => e.status === "completed").length;
              const yearCredits = entries
                .filter((e) => e.status === "completed")
                .reduce((sum, e) => sum + e.credits, 0);

              return (
                <div key={year} className="mb-6">
                  <div className="flex items-center justify-between rounded-t-xl border border-gray-200 bg-gray-100 px-4 py-3">
                    <h2 className="text-lg font-bold text-gray-900">{year}</h2>
                    <div className="flex gap-4 text-sm text-gray-600">
                      <span>{yearCompleted} completed</span>
                      <span>{yearCredits} credits</span>
                    </div>
                  </div>
                  <div className="overflow-x-auto rounded-b-xl border border-t-0 border-gray-200 bg-white">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-medium uppercase text-gray-500">
                          <th
                            className="cursor-pointer px-4 py-3 hover:text-gray-700"
                            onClick={() => handleSort("course_title")}
                          >
                            Course Title <SortIcon field="course_title" />
                          </th>
                          <th className="px-4 py-3">Type</th>
                          <th
                            className="cursor-pointer px-4 py-3 hover:text-gray-700"
                            onClick={() => handleSort("enrollment_date")}
                          >
                            Enrolled <SortIcon field="enrollment_date" />
                          </th>
                          <th
                            className="cursor-pointer px-4 py-3 hover:text-gray-700"
                            onClick={() => handleSort("completion_date")}
                          >
                            Completed <SortIcon field="completion_date" />
                          </th>
                          <th
                            className="cursor-pointer px-4 py-3 hover:text-gray-700"
                            onClick={() => handleSort("status")}
                          >
                            Status <SortIcon field="status" />
                          </th>
                          <th
                            className="cursor-pointer px-4 py-3 hover:text-gray-700"
                            onClick={() => handleSort("score")}
                          >
                            Score <SortIcon field="score" />
                          </th>
                          <th
                            className="cursor-pointer px-4 py-3 hover:text-gray-700"
                            onClick={() => handleSort("credits")}
                          >
                            Credits/Hours <SortIcon field="credits" />
                          </th>
                          <th className="px-4 py-3">Certificate</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {entries.map((entry) => (
                          <tr key={entry.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 font-medium text-gray-900">{entry.course_title}</td>
                            <td className="px-4 py-3">
                              <span
                                className={cn(
                                  "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
                                  COURSE_TYPE_CONFIG[entry.course_type].color
                                )}
                              >
                                {COURSE_TYPE_CONFIG[entry.course_type].label}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-gray-600">{formatDate(entry.enrollment_date)}</td>
                            <td className="px-4 py-3 text-gray-600">{formatDate(entry.completion_date)}</td>
                            <td className="px-4 py-3 text-sm">
                              <StatusBadge status={entry.status} />
                            </td>
                            <td className="px-4 py-3 text-gray-600">
                              {entry.score !== null ? `${entry.score}%` : "\u2014"}
                            </td>
                            <td className="px-4 py-3 text-gray-600">{entry.credits}</td>
                            <td className="px-4 py-3">
                              {entry.certificate_id ? (
                                <button className="text-indigo-600 hover:text-indigo-800" title="View Certificate">
                                  <ExternalLink className="h-4 w-4" />
                                </button>
                              ) : (
                                <span className="text-gray-300">{"\u2014"}</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}

            {grouped.length === 0 && (
              <div className="mt-12 flex flex-col items-center justify-center py-16">
                <FileText className="h-16 w-16 text-gray-300" />
                <h3 className="mt-4 text-lg font-medium text-gray-900">No transcript entries found</h3>
                <p className="mt-1 text-sm text-gray-500">Try adjusting your filters to see results.</p>
              </div>
            )}
          </div>

          {/* Print footer */}
          <div className="print-only hidden mt-8 border-t-2 border-gray-900 pt-4 text-xs text-gray-500">
            <p>This is an official training transcript generated by Acme Corporation LMS. Verification ID: TR-{user.employee_id}-{Date.now()}</p>
          </div>
        </div>
      </div>
    </>
  );
}
