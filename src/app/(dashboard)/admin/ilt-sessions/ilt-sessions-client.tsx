"use client";

import { useState, useMemo } from "react";
import {
  Plus,
  Calendar,
  List,
  MapPin,
  Video,
  Users,
  Clock,
  MoreVertical,
  X,
  Search,
  CheckCircle2,
  AlertCircle,
  XCircle,
  BarChart3,
  TrendingDown,
  CalendarDays,
  ChevronLeft,
  UserCheck,
  UserX,
  Check,
} from "lucide-react";
import { cn } from "@/utils/cn";
import { formatDate } from "@/utils/format";
import type {
  ILTSession,
  ILTAttendance,
  ILTSessionStatus,
  AttendanceStatus,
  ILTLocationType,
} from "@/types/database";

// ─── Exported Interfaces ────────────────────────────────────────

export interface SessionItem {
  id: string;
  course_id: string;
  course_title: string;
  title: string;
  description: string;
  instructor_name: string;
  session_date: string;
  start_time: string;
  end_time: string;
  timezone: string;
  location_type: ILTLocationType;
  location_details: string;
  meeting_url: string | null;
  max_capacity: number;
  registered_count: number;
  status: ILTSessionStatus;
  attendees: AttendeeItem[];
}

export interface AttendeeItem {
  id: string;
  name: string;
  email: string;
  attendance_status: AttendanceStatus | null;
  check_in_time: string | null;
  notes: string;
}

export interface CourseOption {
  id: string;
  title: string;
}

export interface InstructorOption {
  id: string;
  name: string;
}

// ─── Constants ──────────────────────────────────────────────────

const STATUS_CONFIG: Record<ILTSessionStatus, { label: string; color: string }> = {
  scheduled: { label: "Scheduled", color: "bg-blue-100 text-blue-700" },
  in_progress: { label: "In Progress", color: "bg-yellow-100 text-yellow-700" },
  completed: { label: "Completed", color: "bg-green-100 text-green-700" },
  cancelled: { label: "Cancelled", color: "bg-red-100 text-red-700" },
};

const ATTENDANCE_OPTIONS: { value: AttendanceStatus; label: string }[] = [
  { value: "present", label: "Present" },
  { value: "absent", label: "Absent" },
  { value: "late", label: "Late" },
  { value: "excused", label: "Excused" },
  { value: "no_show", label: "No Show" },
];

const LOCATION_ICONS: Record<ILTLocationType, typeof MapPin> = {
  virtual: Video,
  in_person: MapPin,
  hybrid: Users,
};

// ─── Props ──────────────────────────────────────────────────────

interface ILTSessionsClientProps {
  initialSessions: SessionItem[];
  courses: CourseOption[];
  instructors: InstructorOption[];
}

// ─── Component ──────────────────────────────────────────────────

export default function ILTSessionsClient({
  initialSessions,
  courses,
  instructors,
}: ILTSessionsClientProps) {
  const [sessions, setSessions] = useState<SessionItem[]>(initialSessions);
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ILTSessionStatus | "all">("all");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedSession, setSelectedSession] = useState<SessionItem | null>(null);
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    course_id: "",
    title: "",
    description: "",
    session_date: "",
    start_time: "",
    end_time: "",
    timezone: "America/New_York",
    location_type: "virtual" as ILTLocationType,
    location_details: "",
    meeting_url: "",
    max_capacity: 30,
    instructor: "",
  });

  const filteredSessions = useMemo(() => {
    let list = [...sessions];
    if (statusFilter !== "all") {
      list = list.filter((s) => s.status === statusFilter);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          s.course_title.toLowerCase().includes(q) ||
          s.instructor_name.toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => b.session_date.localeCompare(a.session_date));
    return list;
  }, [sessions, statusFilter, searchQuery]);

  // Stats
  const stats = useMemo(() => {
    const upcoming = sessions.filter((s) => s.status === "scheduled").length;
    const completed = sessions.filter((s) => s.status === "completed");
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const thisMonth = sessions.filter((s) => s.session_date.startsWith(currentMonth)).length;

    let totalAttendees = 0;
    let totalPresent = 0;
    let totalNoShow = 0;

    for (const s of completed) {
      for (const a of s.attendees) {
        totalAttendees++;
        if (a.attendance_status === "present" || a.attendance_status === "late") totalPresent++;
        if (a.attendance_status === "no_show") totalNoShow++;
      }
    }

    const attendanceRate = totalAttendees > 0 ? Math.round((totalPresent / totalAttendees) * 100) : 0;
    const noShowRate = totalAttendees > 0 ? Math.round((totalNoShow / totalAttendees) * 100) : 0;

    return { upcoming, attendanceRate, noShowRate, thisMonth };
  }, [sessions]);

  async function handleCreateSession() {
    const courseName = courses.find((c) => c.id === formData.course_id)?.title || "Unknown Course";
    const instructorName = instructors.find((i) => i.id === formData.instructor)?.name || "TBD";

    try {
      const res = await fetch("/api/ilt-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          course_id: formData.course_id,
          title: formData.title,
          description: formData.description,
          session_date: formData.session_date,
          start_time: formData.start_time,
          end_time: formData.end_time,
          timezone: formData.timezone,
          location_type: formData.location_type,
          location_details: formData.location_details,
          meeting_url: formData.meeting_url || null,
          max_capacity: formData.max_capacity,
          instructor_id: formData.instructor || null,
        }),
      });

      if (!res.ok) throw new Error("Failed to create session");

      const created = await res.json();

      const newSession: SessionItem = {
        id: created.id,
        course_id: created.course_id,
        course_title: courseName,
        title: created.title,
        description: created.description,
        instructor_name: instructorName,
        session_date: created.session_date,
        start_time: created.start_time,
        end_time: created.end_time,
        timezone: created.timezone,
        location_type: created.location_type,
        location_details: created.location_details,
        meeting_url: created.meeting_url,
        max_capacity: created.max_capacity,
        registered_count: 0,
        status: "scheduled",
        attendees: [],
      };

      setSessions((prev) => [newSession, ...prev]);
      setShowCreateModal(false);
      setFormData({
        course_id: "",
        title: "",
        description: "",
        session_date: "",
        start_time: "",
        end_time: "",
        timezone: "America/New_York",
        location_type: "virtual",
        location_details: "",
        meeting_url: "",
        max_capacity: 30,
        instructor: "",
      });
    } catch (err) {
      console.error("Error creating session:", err);
    }
  }

  async function handleCancelSession(sessionId: string) {
    try {
      const res = await fetch("/api/ilt-sessions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, action: "update", status: "cancelled" }),
      });

      if (!res.ok) throw new Error("Failed to cancel session");

      setSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? { ...s, status: "cancelled" as ILTSessionStatus } : s))
      );
    } catch (err) {
      console.error("Error cancelling session:", err);
    }
    setActionMenuId(null);
  }

  async function handleDeleteSession(sessionId: string) {
    try {
      const res = await fetch(`/api/ilt-sessions?session_id=${sessionId}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to delete session");

      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    } catch (err) {
      console.error("Error deleting session:", err);
    }
    setActionMenuId(null);
  }

  async function updateAttendance(sessionId: string, attendeeId: string, status: AttendanceStatus) {
    try {
      const res = await fetch("/api/ilt-sessions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          action: "mark_attendance",
          attendee_id: attendeeId,
          attendance_status: status,
        }),
      });

      if (!res.ok) throw new Error("Failed to update attendance");

      const checkInTime = status === "present" || status === "late"
        ? new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })
        : null;

      const updateAttendees = (attendees: AttendeeItem[]) =>
        attendees.map((a) => {
          if (a.id !== attendeeId) return a;
          return {
            ...a,
            attendance_status: status,
            check_in_time: status === "present" || status === "late" ? a.check_in_time || checkInTime : null,
          };
        });

      setSessions((prev) =>
        prev.map((s) => {
          if (s.id !== sessionId) return s;
          return { ...s, attendees: updateAttendees(s.attendees) };
        })
      );
      if (selectedSession && selectedSession.id === sessionId) {
        setSelectedSession((prev) => {
          if (!prev) return prev;
          return { ...prev, attendees: updateAttendees(prev.attendees) };
        });
      }
    } catch (err) {
      console.error("Error updating attendance:", err);
    }
  }

  async function bulkMarkAttendance(sessionId: string, status: AttendanceStatus) {
    const session = sessions.find((s) => s.id === sessionId);
    if (!session) return;

    const unmarked = session.attendees.filter((a) => !a.attendance_status);
    if (unmarked.length === 0) return;

    try {
      const results = await Promise.all(
        unmarked.map((a) =>
          fetch("/api/ilt-sessions", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              session_id: sessionId,
              action: "mark_attendance",
              attendee_id: a.id,
              attendance_status: status,
            }),
          })
        )
      );

      const allOk = results.every((r) => r.ok);
      if (!allOk) throw new Error("Some attendance updates failed");

      const checkInTime = (status === "present" || status === "late")
        ? new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })
        : null;

      const updateAttendees = (attendees: AttendeeItem[]) =>
        attendees.map((a) => ({
          ...a,
          attendance_status: a.attendance_status || status,
          check_in_time: !a.attendance_status && (status === "present" || status === "late")
            ? checkInTime
            : a.check_in_time,
        }));

      setSessions((prev) =>
        prev.map((s) => {
          if (s.id !== sessionId) return s;
          return { ...s, attendees: updateAttendees(s.attendees) };
        })
      );
      if (selectedSession && selectedSession.id === sessionId) {
        setSelectedSession((prev) => {
          if (!prev) return prev;
          return { ...prev, attendees: updateAttendees(prev.attendees) };
        });
      }
    } catch (err) {
      console.error("Error bulk marking attendance:", err);
    }
  }

  // Calendar helpers
  const calendarMonth = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const firstDay = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const startDay = firstDay.getDay();
    const days: { date: number; sessions: SessionItem[] }[] = [];

    for (let i = 0; i < startDay; i++) {
      days.push({ date: 0, sessions: [] });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const daySessions = sessions.filter((s) => s.session_date === dateStr);
      days.push({ date: d, sessions: daySessions });
    }
    return { days, label: firstDay.toLocaleString("default", { month: "long", year: "numeric" }), today: now.getDate() };
  }, [sessions]);

  // ─── Attendance Roster View ──────────────────────────────────

  if (selectedSession) {
    const session = sessions.find((s) => s.id === selectedSession.id) || selectedSession;
    const LocationIcon = LOCATION_ICONS[session.location_type];

    return (
      <div className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <button
            onClick={() => setSelectedSession(null)}
            className="mb-4 inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
          >
            <ChevronLeft className="h-4 w-4" /> Back to Sessions
          </button>

          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h1 className="text-xl font-bold text-gray-900">{session.title}</h1>
                <p className="mt-1 text-sm text-gray-500">{session.course_title}</p>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-gray-600">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" /> {formatDate(session.session_date)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-4 w-4" /> {session.start_time} - {session.end_time}
                  </span>
                  <span className="flex items-center gap-1">
                    <LocationIcon className="h-4 w-4" /> {session.location_details}
                  </span>
                </div>
              </div>
              <span className={cn("rounded-full px-3 py-1 text-sm font-medium", STATUS_CONFIG[session.status].color)}>
                {STATUS_CONFIG[session.status].label}
              </span>
            </div>
          </div>

          {/* Bulk actions */}
          <div className="mt-4 flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">Bulk mark unmarked as:</span>
            <button
              onClick={() => bulkMarkAttendance(session.id, "present")}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              <UserCheck className="h-3.5 w-3.5 text-green-600" /> Present
            </button>
            <button
              onClick={() => bulkMarkAttendance(session.id, "absent")}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              <UserX className="h-3.5 w-3.5 text-red-600" /> Absent
            </button>
            <button
              onClick={() => bulkMarkAttendance(session.id, "no_show")}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              <XCircle className="h-3.5 w-3.5 text-orange-600" /> No Show
            </button>
          </div>

          {/* Roster Table */}
          <div className="mt-4 overflow-hidden rounded-xl border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-medium uppercase text-gray-500">
                  <th className="px-4 py-3">Learner</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Attendance Status</th>
                  <th className="px-4 py-3">Check-in Time</th>
                  <th className="px-4 py-3">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {session.attendees.map((attendee) => (
                  <tr key={attendee.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{attendee.name}</td>
                    <td className="px-4 py-3 text-gray-600">{attendee.email}</td>
                    <td className="px-4 py-3">
                      <select
                        value={attendee.attendance_status || ""}
                        onChange={(e) =>
                          updateAttendance(session.id, attendee.id, e.target.value as AttendanceStatus)
                        }
                        className={cn(
                          "rounded-lg border border-gray-300 px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500",
                          !attendee.attendance_status && "text-gray-400"
                        )}
                      >
                        <option value="">-- Select --</option>
                        {ATTENDANCE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{attendee.check_in_time || "\u2014"}</td>
                    <td className="px-4 py-3 text-gray-600">{attendee.notes || "\u2014"}</td>
                  </tr>
                ))}
                {session.attendees.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                      No attendees registered for this session.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // ─── Main Sessions View ──────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-6 py-8">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">ILT Session Management</h1>
            <p className="mt-1 text-gray-500">Create, manage, and track instructor-led training sessions.</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" /> Create Session
          </button>
        </div>

        {/* Stats */}
        <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                <CalendarDays className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.upcoming}</p>
                <p className="text-xs text-gray-500">Upcoming Sessions</p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100">
                <BarChart3 className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.attendanceRate}%</p>
                <p className="text-xs text-gray-500">Avg Attendance Rate</p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100">
                <TrendingDown className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-2xl font-bold text-gray-900">{stats.noShowRate}%</p>
                  {/* Mini pie indicator */}
                  <div className="relative h-6 w-6">
                    <svg viewBox="0 0 36 36" className="h-6 w-6">
                      <path
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="#e5e7eb"
                        strokeWidth="4"
                      />
                      <path
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="#ef4444"
                        strokeWidth="4"
                        strokeDasharray={`${stats.noShowRate}, 100`}
                      />
                    </svg>
                  </div>
                </div>
                <p className="text-xs text-gray-500">No-Show Rate</p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">
                <Calendar className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.thisMonth}</p>
                <p className="text-xs text-gray-500">Sessions This Month</p>
              </div>
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search sessions..."
              className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as ILTSessionStatus | "all")}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="all">All Statuses</option>
            <option value="scheduled">Scheduled</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <div className="flex rounded-lg border border-gray-300 bg-white">
            <button
              onClick={() => setViewMode("list")}
              className={cn(
                "flex items-center gap-1 px-3 py-2 text-sm font-medium",
                viewMode === "list" ? "bg-indigo-50 text-indigo-600" : "text-gray-600 hover:text-gray-900"
              )}
            >
              <List className="h-4 w-4" /> List
            </button>
            <button
              onClick={() => setViewMode("calendar")}
              className={cn(
                "flex items-center gap-1 border-l border-gray-300 px-3 py-2 text-sm font-medium",
                viewMode === "calendar" ? "bg-indigo-50 text-indigo-600" : "text-gray-600 hover:text-gray-900"
              )}
            >
              <Calendar className="h-4 w-4" /> Calendar
            </button>
          </div>
        </div>

        {/* List View */}
        {viewMode === "list" && (
          <div className="mt-4 overflow-hidden rounded-xl border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-medium uppercase text-gray-500">
                  <th className="px-4 py-3">Session Title</th>
                  <th className="px-4 py-3">Course</th>
                  <th className="px-4 py-3">Instructor</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">Capacity</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredSessions.map((session) => {
                  const LocationIcon = LOCATION_ICONS[session.location_type];
                  return (
                    <tr
                      key={session.id}
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => setSelectedSession(session)}
                    >
                      <td className="px-4 py-3 font-medium text-gray-900">{session.title}</td>
                      <td className="px-4 py-3 text-gray-600">{session.course_title}</td>
                      <td className="px-4 py-3 text-gray-600">{session.instructor_name}</td>
                      <td className="px-4 py-3 text-gray-600">{formatDate(session.session_date)}</td>
                      <td className="px-4 py-3 text-gray-600">
                        {session.start_time} - {session.end_time}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 text-gray-600">
                          <LocationIcon className="h-3.5 w-3.5" /> {session.location_details}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-gray-600">
                          {session.registered_count}/{session.max_capacity}
                        </span>
                        <div className="mt-1 h-1.5 w-16 overflow-hidden rounded-full bg-gray-200">
                          <div
                            className={cn(
                              "h-full rounded-full",
                              session.registered_count / session.max_capacity > 0.9
                                ? "bg-red-500"
                                : session.registered_count / session.max_capacity > 0.7
                                ? "bg-yellow-500"
                                : "bg-green-500"
                            )}
                            style={{
                              width: `${Math.min((session.registered_count / session.max_capacity) * 100, 100)}%`,
                            }}
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
                            STATUS_CONFIG[session.status].color
                          )}
                        >
                          {STATUS_CONFIG[session.status].label}
                        </span>
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="relative">
                          <button
                            onClick={() => setActionMenuId(actionMenuId === session.id ? null : session.id)}
                            className="rounded p-1 hover:bg-gray-100"
                          >
                            <MoreVertical className="h-4 w-4 text-gray-500" />
                          </button>
                          {actionMenuId === session.id && (
                            <div className="absolute right-0 z-10 mt-1 w-40 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                              <button
                                onClick={() => {
                                  setSelectedSession(session);
                                  setActionMenuId(null);
                                }}
                                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                              >
                                View Roster
                              </button>
                              {session.status === "scheduled" && (
                                <button
                                  onClick={() => handleCancelSession(session.id)}
                                  className="w-full px-4 py-2 text-left text-sm text-yellow-700 hover:bg-gray-50"
                                >
                                  Cancel Session
                                </button>
                              )}
                              {session.status === "cancelled" && (
                                <button
                                  onClick={() => handleDeleteSession(session.id)}
                                  className="w-full px-4 py-2 text-left text-sm text-red-700 hover:bg-gray-50"
                                >
                                  Delete Session
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredSessions.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-gray-500">
                      No sessions found matching your criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Calendar View */}
        {viewMode === "calendar" && (
          <div className="mt-4 overflow-hidden rounded-xl border border-gray-200 bg-white">
            <div className="border-b border-gray-200 bg-gray-50 px-4 py-3 text-center font-semibold text-gray-900">
              {calendarMonth.label}
            </div>
            <div className="grid grid-cols-7">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                <div key={d} className="border-b border-gray-200 bg-gray-50 px-2 py-2 text-center text-xs font-medium text-gray-500">
                  {d}
                </div>
              ))}
              {calendarMonth.days.map((day, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "min-h-[80px] border-b border-r border-gray-100 p-1",
                    day.date === 0 && "bg-gray-50"
                  )}
                >
                  {day.date > 0 && (
                    <>
                      <span
                        className={cn(
                          "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs",
                          day.date === calendarMonth.today ? "bg-indigo-600 text-white" : "text-gray-700"
                        )}
                      >
                        {day.date}
                      </span>
                      <div className="mt-1 space-y-0.5">
                        {day.sessions.map((s) => (
                          <button
                            key={s.id}
                            onClick={() => setSelectedSession(s)}
                            className={cn(
                              "block w-full truncate rounded px-1 py-0.5 text-left text-[10px] font-medium",
                              STATUS_CONFIG[s.status].color
                            )}
                            title={s.title}
                          >
                            {s.title}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Create Session Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-lg rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-bold text-gray-900">Create New Session</h2>
              <button onClick={() => setShowCreateModal(false)} className="rounded p-1 hover:bg-gray-100">
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto px-6 py-4">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Course</label>
                  <select
                    value={formData.course_id}
                    onChange={(e) => setFormData({ ...formData, course_id: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="">Select a course...</option>
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Session Title</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    placeholder="e.g., Cloud Security - Cohort C"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={2}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Date</label>
                    <input
                      type="date"
                      value={formData.session_date}
                      onChange={(e) => setFormData({ ...formData, session_date: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Timezone</label>
                    <select
                      value={formData.timezone}
                      onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="America/New_York">Eastern (ET)</option>
                      <option value="America/Chicago">Central (CT)</option>
                      <option value="America/Denver">Mountain (MT)</option>
                      <option value="America/Los_Angeles">Pacific (PT)</option>
                      <option value="UTC">UTC</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Start Time</label>
                    <input
                      type="time"
                      value={formData.start_time}
                      onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">End Time</label>
                    <input
                      type="time"
                      value={formData.end_time}
                      onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Location Type</label>
                  <select
                    value={formData.location_type}
                    onChange={(e) => setFormData({ ...formData, location_type: e.target.value as ILTLocationType })}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="virtual">Virtual</option>
                    <option value="in_person">In-Person</option>
                    <option value="hybrid">Hybrid</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Location Details</label>
                  <input
                    type="text"
                    value={formData.location_details}
                    onChange={(e) => setFormData({ ...formData, location_details: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    placeholder={formData.location_type === "virtual" ? "e.g., Zoom Meeting" : "e.g., Building A, Room 301"}
                  />
                </div>
                {(formData.location_type === "virtual" || formData.location_type === "hybrid") && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Meeting URL</label>
                    <input
                      type="url"
                      value={formData.meeting_url}
                      onChange={(e) => setFormData({ ...formData, meeting_url: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      placeholder="https://..."
                    />
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700">Max Capacity</label>
                  <input
                    type="number"
                    value={formData.max_capacity}
                    onChange={(e) => setFormData({ ...formData, max_capacity: parseInt(e.target.value) || 0 })}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Instructor</label>
                  <select
                    value={formData.instructor}
                    onChange={(e) => setFormData({ ...formData, instructor: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="">Select instructor...</option>
                    {instructors.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 border-t border-gray-200 px-6 py-4">
              <button
                onClick={() => setShowCreateModal(false)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateSession}
                disabled={!formData.course_id || !formData.title || !formData.session_date}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Create Session
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
