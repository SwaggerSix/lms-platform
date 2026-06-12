"use client";

import { useMemo, useState } from "react";
import { Search, Globe, MapPin, Filter } from "lucide-react";

export interface SessionRow {
  id: string;
  title: string;
  description: string | null;
  session_date: string;
  start_time: string | null;
  end_time: string | null;
  timezone: string | null;
  location_type: string | null;
  location_details: string | null;
  status: string | null;
  max_capacity: number | null;
  external_source: string | null;
  external_id: string | null;
  external_synced_at: string | null;
  course_title: string | null;
  course_code: string | null;
  instructor_name: string | null;
  instructor_email: string | null;
}

interface Props {
  initialSessions: SessionRow[];
}

function statusClass(status: string | null): string {
  switch (status) {
    case "scheduled":
      return "bg-indigo-50 text-indigo-700 ring-indigo-200";
    case "in_progress":
      return "bg-amber-50 text-amber-700 ring-amber-200";
    case "completed":
      return "bg-green-50 text-green-700 ring-green-200";
    case "cancelled":
      return "bg-red-50 text-red-700 ring-red-200";
    default:
      return "bg-gray-50 text-gray-700 ring-gray-200";
  }
}

export default function IltSessionsLogClient({ initialSessions }: Props) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return initialSessions.filter((s) => {
      if (statusFilter !== "all" && s.status !== statusFilter) return false;
      if (sourceFilter === "gems" && s.external_source !== "gems") return false;
      if (sourceFilter === "manual" && s.external_source !== null) return false;
      if (!q) return true;
      return (
        s.title.toLowerCase().includes(q) ||
        (s.course_code ?? "").toLowerCase().includes(q) ||
        (s.course_title ?? "").toLowerCase().includes(q) ||
        (s.instructor_name ?? "").toLowerCase().includes(q) ||
        (s.instructor_email ?? "").toLowerCase().includes(q) ||
        (s.location_details ?? "").toLowerCase().includes(q) ||
        (s.external_id ?? "").toLowerCase().includes(q)
      );
    });
  }, [initialSessions, search, statusFilter, sourceFilter]);

  const counts = useMemo(() => {
    return {
      total: initialSessions.length,
      gems: initialSessions.filter((s) => s.external_source === "gems").length,
      scheduled: initialSessions.filter((s) => s.status === "scheduled").length,
      completed: initialSessions.filter((s) => s.status === "completed").length,
    };
  }, [initialSessions]);

  return (
    <div className="container mx-auto max-w-7xl p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">ILT Session Log</h1>
        <p className="mt-1 text-sm text-gray-600">
          Log of all instructor-led training sessions, including events imported from GEMS.
          Showing up to 500 most recent sessions.
        </p>
        <div className="mt-3 flex flex-wrap gap-3 text-xs">
          <span className="rounded-full bg-gray-100 px-2 py-1 text-gray-700">
            {counts.total} total
          </span>
          <span className="rounded-full bg-indigo-100 px-2 py-1 text-indigo-700">
            {counts.gems} from GEMS
          </span>
          <span className="rounded-full bg-blue-50 px-2 py-1 text-blue-700">
            {counts.scheduled} scheduled
          </span>
          <span className="rounded-full bg-green-50 px-2 py-1 text-green-700">
            {counts.completed} completed
          </span>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 bg-white p-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title, course, instructor, location…"
            className="w-full rounded border border-gray-300 px-8 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <div className="inline-flex items-center gap-1.5 text-sm text-gray-700">
          <Filter className="h-4 w-4 text-gray-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded border border-gray-300 px-2 py-1 text-sm bg-white"
          >
            <option value="all">All statuses</option>
            <option value="scheduled">Scheduled</option>
            <option value="in_progress">In progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          className="rounded border border-gray-300 px-2 py-1 text-sm bg-white"
        >
          <option value="all">All sources</option>
          <option value="gems">From GEMS</option>
          <option value="manual">Manual</option>
        </select>
        <span className="ml-auto text-xs text-gray-500">
          {filtered.length} shown
        </span>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Date</th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Title</th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Course</th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Instructor</th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Location</th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Status</th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-sm text-gray-500">
                    No sessions match the current filters.
                  </td>
                </tr>
              )}
              {filtered.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="whitespace-nowrap px-3 py-2 text-sm text-gray-900">
                    {s.session_date}
                    {s.start_time && (
                      <span className="ml-1 text-xs text-gray-500">
                        {s.start_time.slice(0, 5)}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-sm text-gray-900">{s.title}</td>
                  <td className="px-3 py-2 text-sm text-gray-700">
                    {s.course_code && (
                      <span className="mr-1 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-700">
                        {s.course_code}
                      </span>
                    )}
                    {s.course_title ?? <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-3 py-2 text-sm text-gray-700">
                    {s.instructor_name ?? (s.instructor_email ?? <span className="text-gray-400">—</span>)}
                  </td>
                  <td className="px-3 py-2 text-sm text-gray-700">
                    <span className="inline-flex items-center gap-1">
                      {s.location_type === "virtual" ? (
                        <Globe className="h-3.5 w-3.5 text-gray-400" />
                      ) : (
                        <MapPin className="h-3.5 w-3.5 text-gray-400" />
                      )}
                      <span>{s.location_details || s.location_type || "—"}</span>
                    </span>
                  </td>
                  <td className="px-3 py-2 text-sm">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${statusClass(s.status)}`}>
                      {s.status ?? "—"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-sm text-gray-700">
                    {s.external_source === "gems" ? (
                      <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700">
                        GEMS #{s.external_id}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">Manual</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
