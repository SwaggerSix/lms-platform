"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Award, Download, Search, ChevronLeft, Users } from "lucide-react";

export interface CpeRow {
  enrollmentId: string;
  userId: string;
  learnerName: string;
  learnerEmail: string;
  organization: string;
  courseTitle: string;
  courseVersion: string;
  cpeCredits: number;
  completedAt: string;
  score: number | null;
  passingScore: number;
}

interface Props {
  rows: CpeRow[];
  from: string;
  to: string;
  passingOnly: boolean;
  totalCredits: number;
  uniqueLearners: number;
  eligibleCourseCount: number;
}

type GroupMode = "detail" | "learner";

function formatDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const escape = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const csv = [headers.map(escape).join(","), ...rows.map((r) => r.map(escape).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function CpeReportClient({ rows, from, to, passingOnly, totalCredits, uniqueLearners, eligibleCourseCount }: Props) {
  const router = useRouter();
  const [fromDate, setFromDate] = useState(from);
  const [toDate, setToDate] = useState(to);
  const [search, setSearch] = useState("");
  const [groupMode, setGroupMode] = useState<GroupMode>("detail");
  const [passingOnlyState, setPassingOnlyState] = useState(passingOnly);

  const filteredRows = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter(
      (r) =>
        r.learnerName.toLowerCase().includes(q) ||
        r.learnerEmail.toLowerCase().includes(q) ||
        r.courseTitle.toLowerCase().includes(q) ||
        r.organization.toLowerCase().includes(q)
    );
  }, [rows, search]);

  const byLearner = useMemo(() => {
    const map = new Map<string, { name: string; email: string; organization: string; credits: number; courses: number }>();
    for (const r of filteredRows) {
      const existing = map.get(r.userId);
      if (existing) {
        existing.credits += r.cpeCredits;
        existing.courses += 1;
      } else {
        map.set(r.userId, {
          name: r.learnerName,
          email: r.learnerEmail,
          organization: r.organization,
          credits: r.cpeCredits,
          courses: 1,
        });
      }
    }
    return Array.from(map.entries())
      .map(([userId, v]) => ({ userId, ...v }))
      .sort((a, b) => b.credits - a.credits);
  }, [filteredRows]);

  const applyFilters = () => {
    const params = new URLSearchParams();
    if (fromDate) params.set("from", fromDate);
    if (toDate) params.set("to", toDate);
    if (!passingOnlyState) params.set("passing_only", "false");
    router.push(`/admin/reports/cpe?${params.toString()}`);
  };

  const exportDetailCsv = () => {
    downloadCsv(
      `cpe-report-${from}-to-${to}.csv`,
      ["Learner", "Email", "Organization", "Course", "Course Version", "CPE Credits", "Score", "Passing Score", "Completed"],
      filteredRows.map((r) => [
        r.learnerName,
        r.learnerEmail,
        r.organization,
        r.courseTitle,
        r.courseVersion,
        r.cpeCredits,
        r.score ?? "",
        r.passingScore || "",
        r.completedAt ? new Date(r.completedAt).toISOString().slice(0, 10) : "",
      ])
    );
  };

  const exportLearnerCsv = () => {
    downloadCsv(
      `cpe-by-learner-${from}-to-${to}.csv`,
      ["Learner", "Email", "Organization", "Courses Completed", "Total CPE Credits"],
      byLearner.map((l) => [l.name, l.email, l.organization, l.courses, l.credits])
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link href="/admin/reports" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
          <ChevronLeft className="h-4 w-4" /> Back to Reports
        </Link>
        <div className="mt-2 flex items-center justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
              <Award className="h-6 w-6 text-emerald-600" />
              NASBA CPE Report
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              CPE credits earned by learners through completed CPE-eligible courses.
              {passingOnly
                ? " Only completions meeting each course's passing score are counted."
                : " All completions are counted, including those that did not meet the course's passing score."}
            </p>
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Total CPE Awarded</p>
          <p className="mt-2 text-3xl font-bold text-emerald-600">{totalCredits.toLocaleString(undefined, { maximumFractionDigits: 1 })}</p>
          <p className="text-xs text-gray-400">credits in selected range</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Learners Earning Credit</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">{uniqueLearners.toLocaleString()}</p>
          <p className="text-xs text-gray-400">unique learners</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">CPE-Eligible Courses</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">{eligibleCourseCount.toLocaleString()}</p>
          <p className="text-xs text-gray-400">currently flagged</p>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">From</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">To</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <label className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={passingOnlyState}
              onChange={(e) => setPassingOnlyState(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            Passing score only
          </label>
          <button
            onClick={applyFilters}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Apply
          </button>
          <div className="relative flex-1 min-w-[220px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Filter rows by learner, email, course, or organization..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div className="flex items-center gap-1 rounded-lg bg-gray-100 p-1">
            <button
              onClick={() => setGroupMode("detail")}
              className={
                "rounded-md px-3 py-1.5 text-xs font-medium " +
                (groupMode === "detail" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700")
              }
            >
              By Completion
            </button>
            <button
              onClick={() => setGroupMode("learner")}
              className={
                "rounded-md px-3 py-1.5 text-xs font-medium " +
                (groupMode === "learner" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700")
              }
            >
              By Learner
            </button>
          </div>
          <button
            onClick={groupMode === "detail" ? exportDetailCsv : exportLearnerCsv}
            disabled={(groupMode === "detail" ? filteredRows.length : byLearner.length) === 0}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {groupMode === "detail" ? (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Learner</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Organization</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Course</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Credits</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Score</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Completed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm text-gray-500">
                    No CPE credits earned in this date range.
                  </td>
                </tr>
              ) : (
                filteredRows.map((r) => (
                  <tr key={r.enrollmentId} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-gray-900">{r.learnerName}</p>
                      <p className="text-xs text-gray-500">{r.learnerEmail}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{r.organization || "—"}</td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-gray-900">{r.courseTitle}</p>
                      {r.courseVersion && (
                        <p className="text-xs text-gray-400">v{r.courseVersion}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-semibold text-emerald-700">
                      {r.cpeCredits}
                    </td>
                    <td className="px-4 py-3 text-right text-sm">
                      {r.score == null ? (
                        <span className="text-gray-500">—</span>
                      ) : r.passingScore > 0 && r.score < r.passingScore ? (
                        <span className="text-red-600" title={`Below passing score of ${r.passingScore}%`}>{r.score}%</span>
                      ) : (
                        <span className="text-gray-600">{r.score}%</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{formatDate(r.completedAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Learner</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Organization</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Courses</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Total Credits</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {byLearner.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center text-sm text-gray-500">
                    No CPE credits earned in this date range.
                  </td>
                </tr>
              ) : (
                byLearner.map((l) => (
                  <tr key={l.userId} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-gray-900">{l.name}</p>
                      <p className="text-xs text-gray-500">{l.email}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{l.organization || "—"}</td>
                    <td className="px-4 py-3 text-right text-sm text-gray-600">
                      <span className="inline-flex items-center gap-1">
                        <Users className="h-3.5 w-3.5 text-gray-400" /> {l.courses}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-semibold text-emerald-700">
                      {l.credits.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
