"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Download, Star, GraduationCap, BookOpen, TrendingUp } from "lucide-react";
import DataTable, { type DataTableColumn } from "@/components/ui/data-table";

export interface Facet { id: string; label: string }

interface Group { label: string; count: number; course_avg: number | null; instructor_avg: number | null }
interface ReportData {
  totals: { ratings: number; course_avg: number | null; course_count: number; instructor_avg: number | null; instructor_count: number };
  breakdowns: { instructor: Group[]; course: Group[]; class: Group[]; client: Group[] };
  trend: Group[];
}

type DimKey = "instructor" | "course" | "class" | "client";
const DIM_LABELS: Record<DimKey, string> = { instructor: "By instructor", course: "By course", class: "By class", client: "By client" };

export default function RatingsClient({
  instructors, courses, classes, clients,
}: {
  instructors: Facet[]; courses: Facet[]; classes: Facet[]; clients: Facet[];
}) {
  const [filters, setFilters] = useState({ instructor_id: "", course_id: "", class_id: "", tenant_id: "", date_from: "", date_to: "" });
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dim, setDim] = useState<DimKey>("instructor");

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v); });
    try {
      const res = await fetch(`/api/ratings/report?${params.toString()}`);
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  const set = (k: keyof typeof filters, v: string) => setFilters((f) => ({ ...f, [k]: v }));
  const anyFilter = Object.values(filters).some(Boolean);
  const rows = data?.breakdowns[dim] ?? [];
  const maxCount = useMemo(() => Math.max(1, ...rows.map((r) => r.count)), [rows]);

  const breakdownColumns = useMemo<DataTableColumn<Group>[]>(() => [
    {
      key: "label",
      header: DIM_LABELS[dim].replace("By ", ""),
      sortValue: (r) => r.label,
      render: (r) => <span className="text-gray-800">{r.label}</span>,
    },
    {
      key: "count",
      header: "Ratings",
      className: "w-1/3",
      sortValue: (r) => r.count,
      render: (r) => (
        <div className="flex items-center gap-2">
          <div className="h-2 flex-1 rounded-full bg-gray-100"><div className="h-2 rounded-full bg-amber-400" style={{ width: `${(r.count / maxCount) * 100}%` }} /></div>
          <span className="w-8 text-right text-xs text-gray-500">{r.count}</span>
        </div>
      ),
    },
    {
      key: "course",
      header: "Course ★",
      sortValue: (r) => r.course_avg,
      render: (r) => <span className="text-gray-700">{r.course_avg != null ? `${r.course_avg}` : "—"}</span>,
    },
    {
      key: "instructor",
      header: "Instructor ★",
      sortValue: (r) => r.instructor_avg,
      render: (r) => <span className="text-gray-700">{r.instructor_avg != null ? `${r.instructor_avg}` : "—"}</span>,
    },
  ], [dim, maxCount]);

  const exportCsv = () => {
    if (!data) return;
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const lines = [
      `# Ratings (${DIM_LABELS[dim]})`,
      ["Group", "Ratings", "Course avg", "Instructor avg"].map(esc).join(","),
      ...rows.map((r) => [r.label, String(r.count), r.course_avg ?? "", r.instructor_avg ?? ""].map((x) => esc(String(x))).join(",")),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `ratings-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const Select = ({ value, onChange, placeholder, options }: { value: string; onChange: (v: string) => void; placeholder: string; options: Facet[] }) => (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm">
      <option value="">{placeholder}</option>
      {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
    </select>
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Course &amp; Instructor Ratings</h1>
          <p className="mt-1 text-sm text-gray-500">Five-star performance by class, instructor, client, and over time.</p>
        </div>
        <button onClick={exportCsv} disabled={!data || data.totals.ratings === 0}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
          <Download className="h-4 w-4" /> Export CSV
        </button>
      </div>

      <div className="mb-6 flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white p-4">
        <Select value={filters.instructor_id} onChange={(v) => set("instructor_id", v)} placeholder="All instructors" options={instructors} />
        <Select value={filters.course_id} onChange={(v) => set("course_id", v)} placeholder="All courses" options={courses} />
        <Select value={filters.class_id} onChange={(v) => set("class_id", v)} placeholder="All classes" options={classes} />
        <Select value={filters.tenant_id} onChange={(v) => set("tenant_id", v)} placeholder="All clients" options={clients} />
        <div><label className="mb-1 block text-[11px] text-gray-500">From</label>
          <input type="date" value={filters.date_from} onChange={(e) => set("date_from", e.target.value)} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm" /></div>
        <div><label className="mb-1 block text-[11px] text-gray-500">To</label>
          <input type="date" value={filters.date_to} onChange={(e) => set("date_to", e.target.value)} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm" /></div>
        {anyFilter && (
          <button onClick={() => setFilters({ instructor_id: "", course_id: "", class_id: "", tenant_id: "", date_from: "", date_to: "" })}
            className="text-sm text-indigo-600 hover:text-indigo-800">Clear</button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-400"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : !data || data.totals.ratings === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white py-16 text-center text-sm text-gray-500">
          No ratings match these filters yet.
        </div>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-3">
            <Card icon={<Star className="h-5 w-5 text-amber-600" />} bg="bg-amber-100" value={String(data.totals.ratings)} label="Total ratings" />
            <Card icon={<BookOpen className="h-5 w-5 text-blue-600" />} bg="bg-blue-100" value={data.totals.course_avg != null ? `${data.totals.course_avg}★` : "—"} label={`Course avg · ${data.totals.course_count}`} />
            <Card icon={<GraduationCap className="h-5 w-5 text-indigo-600" />} bg="bg-indigo-100" value={data.totals.instructor_avg != null ? `${data.totals.instructor_avg}★` : "—"} label={`Instructor avg · ${data.totals.instructor_count}`} />
          </div>

          <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              {(Object.keys(DIM_LABELS) as DimKey[]).map((d) => (
                <button key={d} onClick={() => setDim(d)}
                  className={`rounded-full px-3 py-1 text-xs font-medium ${dim === d ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                  {DIM_LABELS[d]}
                </button>
              ))}
            </div>
            <DataTable
              columns={breakdownColumns}
              rows={rows}
              rowKey={(r) => r.label}
              initialSort="-count"
              ariaLabel={`Ratings ${DIM_LABELS[dim].toLowerCase()}`}
              emptyState={{
                icon: <Star className="h-10 w-10" aria-hidden="true" />,
                title: "No ratings match these filters yet.",
              }}
            />
          </div>

          {data.trend.length > 1 && (
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900"><TrendingUp className="h-4 w-4 text-indigo-600" /> Over time (monthly)</h2>
              <DataTable
                columns={trendColumns}
                rows={data.trend}
                rowKey={(t) => t.label}
                initialSort="month"
                ariaLabel="Ratings over time (monthly)"
                emptyState={{
                  icon: <TrendingUp className="h-10 w-10" aria-hidden="true" />,
                  title: "No ratings match these filters yet.",
                }}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Card({ icon, bg, value, label }: { icon: React.ReactNode; bg: string; value: string; label: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${bg}`}>{icon}</div>
        <div><p className="text-2xl font-bold text-gray-900">{value}</p><p className="text-xs text-gray-500">{label}</p></div>
      </div>
    </div>
  );
}
