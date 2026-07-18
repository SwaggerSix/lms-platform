"use client";

import { useMemo, useState } from "react";
import AdminAnalyticsTabs from "@/components/layout/admin-analytics-tabs";
import { Download, Grid3x3 } from "lucide-react";
import { cn } from "@/utils/cn";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";

export interface MatrixRow {
  user_id: string;
  user_name: string;
  email: string;
  department: string;
  requirement_id: string;
  requirement_name: string;
  course_title: string;
  frequency_months: number | null;
  last_completed: string | null;
  next_due: string | null;
  days_until_due: number | null;
  status: string;
}

const STATUS_META: Record<
  string,
  { label: string; short: string; chip: string }
> = {
  compliant: { label: "Compliant", short: "✓", chip: "bg-green-100 text-green-700" },
  expiring: { label: "Expiring soon", short: "!", chip: "bg-amber-100 text-amber-700" },
  overdue: { label: "Recert overdue", short: "✕", chip: "bg-red-100 text-red-700" },
  non_compliant: { label: "Not completed", short: "…", chip: "bg-orange-100 text-orange-700" },
  not_enrolled: { label: "Not enrolled", short: "—", chip: "bg-gray-100 text-gray-500" },
};

// Ordered worst-first, for the summary chips and legend.
const STATUS_ORDER = [
  "overdue",
  "not_enrolled",
  "non_compliant",
  "expiring",
  "compliant",
];

function cellTitle(cell: MatrixRow): string {
  const parts = [STATUS_META[cell.status]?.label ?? cell.status];
  if (cell.last_completed) {
    parts.push(`Last completed ${cell.last_completed.split("T")[0]}`);
  }
  if (cell.next_due) {
    parts.push(`Next due ${cell.next_due.split("T")[0]}`);
  }
  return parts.join(" · ");
}

export default function TrainingMatrixClient({ rows }: { rows: MatrixRow[] }) {
  const [department, setDepartment] = useState("All");

  const departments = useMemo(
    () => [...new Set(rows.map((r) => r.department))].sort(),
    [rows]
  );

  const filtered = useMemo(
    () => (department === "All" ? rows : rows.filter((r) => r.department === department)),
    [rows, department]
  );

  const requirements = useMemo(() => {
    const seen = new Map<string, { id: string; name: string; course: string }>();
    for (const r of rows) {
      if (!seen.has(r.requirement_id)) {
        seen.set(r.requirement_id, {
          id: r.requirement_id,
          name: r.requirement_name,
          course: r.course_title,
        });
      }
    }
    return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [rows]);

  const people = useMemo(() => {
    const seen = new Map<
      string,
      { id: string; name: string; email: string; department: string }
    >();
    for (const r of filtered) {
      if (!seen.has(r.user_id)) {
        seen.set(r.user_id, {
          id: r.user_id,
          name: r.user_name,
          email: r.email,
          department: r.department,
        });
      }
    }
    return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [filtered]);

  const cells = useMemo(() => {
    const map = new Map<string, MatrixRow>();
    for (const r of filtered) map.set(`${r.user_id}:${r.requirement_id}`, r);
    return map;
  }, [filtered]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of filtered) counts[r.status] = (counts[r.status] ?? 0) + 1;
    return counts;
  }, [filtered]);

  const exportCSV = () => {
    if (people.length === 0) return;
    const headers = ["Learner", "Email", "Department", ...requirements.map((q) => q.name)];
    const lines = [headers, ...people.map((p) => [
      p.name,
      p.email,
      p.department,
      ...requirements.map((q) => {
        const cell = cells.get(`${p.id}:${q.id}`);
        return cell ? STATUS_META[cell.status]?.label ?? cell.status : "";
      }),
    ])].map((cols) =>
      cols
        .map((v) => {
          const str = String(v ?? "");
          return str.includes(",") || str.includes('"') || str.includes("\n")
            ? `"${str.replace(/"/g, '""')}"`
            : str;
        })
        .join(",")
    );
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `training_matrix_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8">
      <AdminAnalyticsTabs />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Training Matrix</h1>
          <p className="mt-1 text-sm text-gray-500">
            Every active learner against every required training, with compliance status per cell
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            aria-label="Filter by department"
          >
            <option value="All">All Departments</option>
            {departments.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
          <button
            onClick={exportCSV}
            disabled={people.length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" />
            CSV
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {STATUS_ORDER.map((status) => (
          <span
            key={status}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium",
              STATUS_META[status].chip
            )}
          >
            {STATUS_META[status].label}
            <span className="font-semibold">{statusCounts[status] ?? 0}</span>
          </span>
        ))}
      </div>

      {requirements.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-10 text-center shadow-sm">
          <Grid3x3 className="mx-auto h-8 w-8 text-gray-400" />
          <p className="mt-3 text-sm font-medium text-gray-900">No compliance requirements yet</p>
          <p className="mt-1 text-sm text-gray-500">
            Create course-linked requirements under Compliance to populate the matrix.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 z-10 bg-white min-w-48">Learner</TableHead>
                {requirements.map((q) => (
                  <TableHead key={q.id} className="min-w-32 max-w-40">
                    <span title={`${q.name} · ${q.course}`} className="block truncate">
                      {q.name}
                    </span>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {people.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="sticky left-0 z-10 bg-white">
                    <p className="text-sm font-medium text-gray-900">{p.name}</p>
                    <p className="text-xs text-gray-500">{p.department}</p>
                  </TableCell>
                  {requirements.map((q) => {
                    const cell = cells.get(`${p.id}:${q.id}`);
                    const meta = cell ? STATUS_META[cell.status] : null;
                    return (
                      <TableCell key={q.id}>
                        {cell && meta ? (
                          <span
                            title={cellTitle(cell)}
                            className={cn(
                              "inline-flex min-w-8 justify-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
                              meta.chip
                            )}
                          >
                            {meta.short}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">–</span>
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
