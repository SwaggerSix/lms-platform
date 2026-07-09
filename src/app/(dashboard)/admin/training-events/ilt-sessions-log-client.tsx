"use client";

import { useMemo, useState } from "react";
import AdminSessionsTabs from "@/components/layout/admin-sessions-tabs";
import { Search, Globe, MapPin, Filter, CalendarDays } from "lucide-react";
import DataTable, { type DataTableColumn } from "@/components/ui/data-table";

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
      return "bg-primary-50 text-primary-700 ring-primary-200";
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
      <AdminSessionsTabs />
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Session Log</h1>
        <p className="mt-1 text-sm text-gray-600">
          Log of all instructor-led training sessions, including events imported from GEMS.
          Showing up to 500 most recent sessions.
        </p>
        <div className="mt-3 flex flex-wrap gap-3 text-xs">
          <span className="rounded-full bg-gray-100 px-2 py-1 text-gray-700">
            {counts.total} total
          </span>
          <span className="rounded-full bg-primary-100 px-2 py-1 text-primary-700">
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
            className="w-full rounded border border-gray-300 px-8 py-1.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
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

      <DataTable
        columns={columns}
        rows={filtered}
        rowKey={(s) => s.id}
        initialSort="-date"
        ariaLabel="Instructor-led session log"
        emptyState={{
          icon: <CalendarDays className="h-10 w-10" aria-hidden="true" />,
          title: "No sessions match the current filters",
          description: "Try broadening your search or clearing the status and source filters.",
        }}
      />
    </div>
  );
}

const columns: DataTableColumn<SessionRow>[] = [
  {
    key: "date",
    header: "Date",
    sortValue: (s) => `${s.session_date} ${s.start_time ?? ""}`,
    className: "whitespace-nowrap",
    render: (s) => (
      <span className="text-gray-900">
        {s.session_date}
        {s.start_time && (
          <span className="ml-1 text-xs text-gray-500">{s.start_time.slice(0, 5)}</span>
        )}
      </span>
    ),
  },
  {
    key: "title",
    header: "Title",
    sortValue: (s) => s.title,
    render: (s) => <span className="text-gray-900">{s.title}</span>,
  },
  {
    key: "course",
    header: "Course",
    sortValue: (s) => s.course_title,
    render: (s) => (
      <>
        {s.course_code && (
          <span className="mr-1 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-700">
            {s.course_code}
          </span>
        )}
        {s.course_title ?? <span className="text-gray-500">—</span>}
      </>
    ),
  },
  {
    key: "instructor",
    header: "Instructor",
    sortValue: (s) => s.instructor_name ?? s.instructor_email,
    render: (s) =>
      s.instructor_name ?? s.instructor_email ?? <span className="text-gray-500">—</span>,
  },
  {
    key: "location",
    header: "Location",
    render: (s) => (
      <span className="inline-flex items-center gap-1">
        {s.location_type === "virtual" ? (
          <Globe className="h-3.5 w-3.5 text-gray-400" aria-hidden="true" />
        ) : (
          <MapPin className="h-3.5 w-3.5 text-gray-400" aria-hidden="true" />
        )}
        <span>{s.location_details || s.location_type || "—"}</span>
      </span>
    ),
  },
  {
    key: "status",
    header: "Status",
    sortValue: (s) => s.status,
    render: (s) => (
      <span
        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${statusClass(s.status)}`}
      >
        {s.status ?? "—"}
      </span>
    ),
  },
  {
    key: "source",
    header: "Source",
    sortValue: (s) => s.external_source ?? "manual",
    render: (s) =>
      s.external_source === "gems" ? (
        <span className="rounded bg-primary-50 px-1.5 py-0.5 text-[10px] font-medium text-primary-700">
          GEMS #{s.external_id}
        </span>
      ) : (
        <span className="text-xs text-gray-500">Manual</span>
      ),
  },
];
