"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AdminAnalyticsTabs from "@/components/layout/admin-analytics-tabs";
import { Loader2, Download, Star, TrendingUp, Users, MessageSquareQuote, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import DataTable, { type DataTableColumn } from "@/components/ui/data-table";

export interface Facet { id: string; label: string }

interface Group { label: string; responses: number; avg_rating: number | null }
interface ReportData {
  totals: {
    responses: number;
    respondents: number;
    courses: number;
    avg_rating: number | null;
    rating_count: number;
    nps: number | null;
    nps_count: number;
  };
  breakdowns: { instructor: Group[]; course: Group[]; domain: Group[]; client: Group[] };
  testimonials: { text: string; course: string | null; instructor: string | null; client: string | null; date: string | null }[];
}

const LEVELS = [
  { id: "1", label: "L1 · Reaction" },
  { id: "2", label: "L2 · Learning" },
  { id: "3", label: "L3 · Behavior" },
  { id: "4", label: "L4 · Results" },
];

type DimKey = "instructor" | "course" | "domain" | "client";
const DIM_LABELS: Record<DimKey, string> = {
  instructor: "By instructor",
  course: "By course",
  domain: "By domain",
  client: "By client",
};

export default function InsightsClient({
  courses, domains, instructors, clients,
}: {
  courses: Facet[]; domains: Facet[]; instructors: Facet[]; clients: Facet[];
}) {
  const [filters, setFilters] = useState({
    course_id: "", category_id: "", instructor_id: "", tenant_id: "", level: "", date_from: "", date_to: "",
  });
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dim, setDim] = useState<DimKey>("instructor");

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v); });
    try {
      const res = await fetch(`/api/evaluations/reports?${params.toString()}`);
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  const set = (k: keyof typeof filters, v: string) => setFilters((f) => ({ ...f, [k]: v }));
  const anyFilter = Object.values(filters).some(Boolean);

  const rows = data?.breakdowns[dim] ?? [];

  const exportCsv = () => {
    if (!data) return;
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const lines: string[] = [];
    lines.push(`# Evaluation insights (${DIM_LABELS[dim]})`);
    lines.push(["Group", "Responses", "Avg rating"].map(esc).join(","));
    for (const r of rows) lines.push([r.label, String(r.responses), r.avg_rating != null ? String(r.avg_rating) : ""].map(esc).join(","));
    lines.push("");
    lines.push("# Testimonials");
    lines.push(["Quote", "Course", "Instructor", "Client", "Date"].map(esc).join(","));
    for (const t of data.testimonials) {
      lines.push([t.text, t.course ?? "", t.instructor ?? "", t.client ?? "", t.date ?? ""].map(esc).join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `evaluation-insights-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const Select = ({ value, onChange, placeholder, options }: { value: string; onChange: (v: string) => void; placeholder: string; options: Facet[] }) => (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm">
      <option value="">{placeholder}</option>
      {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
    </select>
  );

  const maxResponses = useMemo(() => Math.max(1, ...rows.map((r) => r.responses)), [rows]);

  const breakdownColumns = useMemo<DataTableColumn<Group>[]>(() => [
    {
      key: "label",
      header: DIM_LABELS[dim].replace("By ", ""),
      sortValue: (r) => r.label,
      render: (r) => <span className="text-gray-800">{r.label}</span>,
    },
    {
      key: "responses",
      header: "Responses",
      className: "w-1/2",
      sortValue: (r) => r.responses,
      render: (r) => (
        <div className="flex items-center gap-2">
          <div className="h-2 flex-1 rounded-full bg-gray-100">
            <div className="h-2 rounded-full bg-indigo-500" style={{ width: `${(r.responses / maxResponses) * 100}%` }} />
          </div>
          <span className="w-8 text-right text-xs text-gray-500">{r.responses}</span>
        </div>
      ),
    },
    {
      key: "avg_rating",
      header: "Avg rating",
      sortValue: (r) => r.avg_rating,
      render: (r) => <span className="text-gray-700">{r.avg_rating != null ? `${r.avg_rating}` : "—"}</span>,
    },
  ], [dim, maxResponses]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <AdminAnalyticsTabs />
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Evaluation Insights</h1>
          <p className="mt-1 text-sm text-gray-500">Filter evaluation results to build your story — ratings, NPS, and testimonials.</p>
        </div>
        <Button variant="outline" onClick={exportCsv} disabled={!data || data.totals.responses === 0}>
          <Download className="h-4 w-4" /> Export CSV
        </Button>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white p-4">
        <Select value={filters.course_id} onChange={(v) => set("course_id", v)} placeholder="All courses" options={courses} />
        <Select value={filters.category_id} onChange={(v) => set("category_id", v)} placeholder="All domains" options={domains} />
        <Select value={filters.instructor_id} onChange={(v) => set("instructor_id", v)} placeholder="All instructors" options={instructors} />
        <Select value={filters.tenant_id} onChange={(v) => set("tenant_id", v)} placeholder="All clients" options={clients} />
        <Select value={filters.level} onChange={(v) => set("level", v)} placeholder="All levels" options={LEVELS} />
        <div>
          <label className="mb-1 block text-[11px] text-gray-500">From</label>
          <input type="date" value={filters.date_from} onChange={(e) => set("date_from", e.target.value)} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-[11px] text-gray-500">To</label>
          <input type="date" value={filters.date_to} onChange={(e) => set("date_to", e.target.value)} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm" />
        </div>
        {anyFilter && (
          <button
            onClick={() => setFilters({ course_id: "", category_id: "", instructor_id: "", tenant_id: "", level: "", date_from: "", date_to: "" })}
            className="text-sm text-indigo-600 hover:text-indigo-800"
          >
            Clear
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-400"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : !data || data.totals.responses === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white py-16 text-center text-sm text-gray-500">
          No evaluation responses match these filters.
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Card icon={<Users className="h-5 w-5 text-blue-600" />} bg="bg-blue-100" value={String(data.totals.responses)} label={`Responses · ${data.totals.respondents} learners`} />
            <Card icon={<Star className="h-5 w-5 text-amber-600" />} bg="bg-amber-100" value={data.totals.avg_rating != null ? `${data.totals.avg_rating}` : "—"} label={`Avg rating · ${data.totals.rating_count} rated`} />
            <Card icon={<TrendingUp className="h-5 w-5 text-green-600" />} bg="bg-green-100" value={data.totals.nps != null ? `${data.totals.nps}` : "—"} label={`NPS · ${data.totals.nps_count} scored`} />
            <Card icon={<BarChart3 className="h-5 w-5 text-indigo-600" />} bg="bg-indigo-100" value={String(data.totals.courses)} label="Courses covered" />
          </div>

          {/* Breakdown */}
          <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              {(Object.keys(DIM_LABELS) as DimKey[]).map((d) => (
                <button
                  key={d}
                  onClick={() => setDim(d)}
                  aria-pressed={dim === d}
                  className={`rounded-full px-3 py-1 text-xs font-medium ${dim === d ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                >
                  {DIM_LABELS[d]}
                </button>
              ))}
            </div>
            <DataTable
              columns={breakdownColumns}
              rows={rows}
              rowKey={(r) => r.label}
              initialSort="-responses"
              ariaLabel={`Evaluation results ${DIM_LABELS[dim].toLowerCase()}`}
              emptyState={{
                icon: <BarChart3 className="h-10 w-10" aria-hidden="true" />,
                title: "No evaluation responses match these filters.",
              }}
            />
          </div>

          {/* Testimonials */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900">
              <MessageSquareQuote className="h-4 w-4 text-indigo-600" /> Testimonials
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-normal text-gray-500">{data.testimonials.length}</span>
            </h2>
            {data.testimonials.length === 0 ? (
              <p className="py-2 text-sm text-gray-400">No written feedback in this selection.</p>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {data.testimonials.slice(0, 40).map((t, i) => (
                  <blockquote key={i} className="rounded-lg border-l-4 border-indigo-200 bg-gray-50 p-3">
                    <p className="text-sm text-gray-700">“{t.text}”</p>
                    <footer className="mt-1.5 text-xs text-gray-400">
                      {[t.course, t.instructor, t.client].filter(Boolean).join(" · ")}
                    </footer>
                  </blockquote>
                ))}
              </div>
            )}
          </div>
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
        <div>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          <p className="text-xs text-gray-500">{label}</p>
        </div>
      </div>
    </div>
  );
}
