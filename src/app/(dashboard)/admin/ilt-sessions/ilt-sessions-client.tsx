"use client";

import { useState, useMemo } from "react";
import {
  Plus,
  Calendar,
  List,
  Search,
  BarChart3,
  TrendingDown,
  CalendarDays,
} from "lucide-react";
import { cn } from "@/utils/cn";
import { Button } from "@/components/ui/button";
import { PageIntro } from "@/components/ui/page-intro";
import { ResultLimitNotice } from "@/components/ui/result-limit-notice";
import AdminSessionsTabs from "@/components/layout/admin-sessions-tabs";
import type { ILTSessionStatus, AttendanceStatus } from "@/types/database";
import type { AttendeeItem, CourseOption, InstructorOption, SessionItem } from "./sessions-shared";
import SessionsList from "./sessions-list";
import SessionsCalendar from "./sessions-calendar";
import SessionRoster from "./session-roster";
import CreateSessionModal from "./create-session-modal";

interface ILTSessionsClientProps {
  initialSessions: SessionItem[];
  courses: CourseOption[];
  instructors: InstructorOption[];
  totalCount?: number;
}

export default function ILTSessionsClient({
  initialSessions,
  courses,
  instructors,
  totalCount,
}: ILTSessionsClientProps) {
  const [sessions, setSessions] = useState<SessionItem[]>(initialSessions);
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ILTSessionStatus | "all">("all");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  const selectedSession = selectedSessionId
    ? sessions.find((s) => s.id === selectedSessionId) ?? null
    : null;

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
    } catch (err) {
      console.error("Error bulk marking attendance:", err);
    }
  }

  // ─── Attendance Roster View ──────────────────────────────────

  if (selectedSession) {
    return (
      <SessionRoster
        session={selectedSession}
        onBack={() => setSelectedSessionId(null)}
        onUpdateAttendance={updateAttendance}
        onBulkMarkAttendance={bulkMarkAttendance}
      />
    );
  }

  // ─── Main Sessions View ──────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <AdminSessionsTabs />
        <PageIntro
          title="Webinars & Open Learning Events"
          description="Post and manage webinars and open learning events — schedule, register attendees, and track attendance."
          actions={
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus className="h-4 w-4" /> Create Session
            </Button>
          }
        />

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
              className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as ILTSessionStatus | "all")}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
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
              aria-pressed={viewMode === "list"}
              className={cn(
                "flex items-center gap-1 px-3 py-2 text-sm font-medium",
                viewMode === "list" ? "bg-primary-50 text-primary-600" : "text-gray-600 hover:text-gray-900"
              )}
            >
              <List className="h-4 w-4" /> List
            </button>
            <button
              onClick={() => setViewMode("calendar")}
              aria-pressed={viewMode === "calendar"}
              className={cn(
                "flex items-center gap-1 border-l border-gray-300 px-3 py-2 text-sm font-medium",
                viewMode === "calendar" ? "bg-primary-50 text-primary-600" : "text-gray-600 hover:text-gray-900"
              )}
            >
              <Calendar className="h-4 w-4" /> Calendar
            </button>
          </div>
        </div>

        {viewMode === "list" && (
          <ResultLimitNotice
            shown={sessions.length}
            total={totalCount ?? sessions.length}
            noun="sessions"
            className="mb-3"
          />
        )}

        {viewMode === "list" && (
          <SessionsList
            sessions={filteredSessions}
            onSelect={(session) => setSelectedSessionId(session.id)}
            onCancel={handleCancelSession}
            onDelete={handleDeleteSession}
          />
        )}

        {viewMode === "calendar" && (
          <SessionsCalendar
            sessions={sessions}
            onSelect={(session) => setSelectedSessionId(session.id)}
          />
        )}
      </div>

      {showCreateModal && (
        <CreateSessionModal
          courses={courses}
          instructors={instructors}
          onClose={() => setShowCreateModal(false)}
          onCreated={(session) => setSessions((prev) => [session, ...prev])}
        />
      )}
    </div>
  );
}
