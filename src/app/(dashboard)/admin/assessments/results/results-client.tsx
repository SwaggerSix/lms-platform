"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Download, FileQuestion, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import DataTable, { type DataTableColumn } from "@/components/ui/data-table";

interface Assessment { id: string; title: string }
interface Result {
  id: string;
  learner_name: string;
  learner_email: string | null;
  assessment_title: string;
  course_title: string | null;
  class_title: string | null;
  score: number | null;
  passed: boolean;
  time_spent: number | null;
  completed_at: string | null;
}

export default function ResultsClient({ assessments }: { assessments: Assessment[] }) {
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(true);
  const [assessmentId, setAssessmentId] = useState("");
  const [passed, setPassed] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (assessmentId) params.set("assessment_id", assessmentId);
    if (passed) params.set("passed", passed);
    try {
      const res = await fetch(`/api/assessments/results?${params.toString()}`);
      if (res.ok) setResults((await res.json()).results ?? []);
    } finally {
      setLoading(false);
    }
  }, [assessmentId, passed]);

  useEffect(() => { load(); }, [load]);

  const exportCsv = () => {
    const headers = ["Learner", "Email", "Examination", "Course", "Class", "Score (%)", "Result", "Time (s)", "Completed"];
    const rows = results.map((r) => [
      r.learner_name,
      r.learner_email ?? "",
      r.assessment_title,
      r.course_title ?? "",
      r.class_title ?? "",
      r.score != null ? Math.round(r.score).toString() : "",
      r.passed ? "Passed" : "Not passed",
      r.time_spent != null ? r.time_spent.toString() : "",
      r.completed_at ?? "",
    ]);
    const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const csv = [headers, ...rows].map((row) => row.map(escape).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `exam-results-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Examination Results</h1>
          <p className="mt-1 text-sm text-gray-500">Per-learner exam scores and pass/fail records.</p>
        </div>
        <Button variant="outline" onClick={exportCsv} disabled={results.length === 0}>
          <Download className="h-4 w-4" /> Export CSV
        </Button>
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white p-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Examination</label>
          <select value={assessmentId} onChange={(e) => setAssessmentId(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm">
            <option value="">All examinations</option>
            {assessments.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Result</label>
          <select value={passed} onChange={(e) => setPassed(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm">
            <option value="">All</option>
            <option value="true">Passed</option>
            <option value="false">Not passed</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center rounded-xl border border-gray-200 bg-white py-16 text-gray-400">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : (
        <DataTable
          columns={columns}
          rows={results}
          rowKey={(r) => r.id}
          ariaLabel="Examination results"
          initialSort="-completed"
          emptyState={{
            icon: <FileQuestion className="h-10 w-10" aria-hidden="true" />,
            title: "No results match these filters.",
          }}
        />
      )}
    </div>
  );
}

const columns: DataTableColumn<Result>[] = [
  {
    key: "learner",
    header: "Learner",
    sortValue: (r) => r.learner_name,
    render: (r) => (
      <div>
        <p className="font-medium text-gray-900">{r.learner_name}</p>
        {r.learner_email && <p className="text-xs text-gray-500">{r.learner_email}</p>}
      </div>
    ),
  },
  {
    key: "assessment",
    header: "Examination",
    sortValue: (r) => r.assessment_title,
    render: (r) => <span className="text-gray-700">{r.assessment_title}</span>,
  },
  {
    key: "course",
    header: "Course",
    sortValue: (r) => r.course_title,
    render: (r) => <span className="text-gray-500">{r.course_title ?? "—"}</span>,
  },
  {
    key: "class",
    header: "Class",
    sortValue: (r) => r.class_title,
    render: (r) => <span className="text-gray-500">{r.class_title ?? "—"}</span>,
  },
  {
    key: "score",
    header: "Score",
    sortValue: (r) => r.score,
    render: (r) => <span className="text-gray-700">{r.score != null ? `${Math.round(r.score)}%` : "—"}</span>,
  },
  {
    key: "result",
    header: "Result",
    sortValue: (r) => (r.passed ? "Passed" : "Not passed"),
    render: (r) =>
      r.passed ? (
        <span className="inline-flex items-center gap-1 text-green-700"><CheckCircle2 className="h-4 w-4" /> Passed</span>
      ) : (
        <span className="inline-flex items-center gap-1 text-red-700"><XCircle className="h-4 w-4" /> Not passed</span>
      ),
  },
  {
    key: "completed",
    header: "Completed",
    sortValue: (r) => r.completed_at,
    render: (r) => (
      <span className="text-gray-500">{r.completed_at ? new Date(r.completed_at).toLocaleDateString() : "—"}</span>
    ),
  },
];
