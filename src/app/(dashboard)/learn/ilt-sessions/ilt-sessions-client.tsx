"use client";

import { useState, useMemo } from "react";
import {
  Calendar,
  Clock,
  MapPin,
  Video,
  Users,
  User,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/utils/cn";
import { trackEvent } from "@/lib/analytics/track";
import type { ILTSessionStatus, ILTLocationType, AttendanceStatus } from "@/types/database";

export interface LearnerSession {
  id: string;
  course_title: string;
  session_title: string;
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
  is_registered: boolean;
  attendance_status: AttendanceStatus | null;
  completion_status: "not_started" | "completed" | null;
}

export interface ILTSessionsClientProps {
  sessions: LearnerSession[];
}

const TABS = [
  { key: "upcoming", label: "Upcoming" },
  { key: "past", label: "Past" },
  { key: "all", label: "All" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const LOCATION_ICONS: Record<ILTLocationType, typeof MapPin> = {
  virtual: Video,
  in_person: MapPin,
  hybrid: Users,
};

const LOCATION_LABELS: Record<ILTLocationType, string> = {
  virtual: "Virtual",
  in_person: "In-Person",
  hybrid: "Hybrid",
};

function AttendanceBadge({ status }: { status: AttendanceStatus | null }) {
  if (!status) return null;
  const config: Record<AttendanceStatus, { label: string; color: string; icon: typeof CheckCircle2 }> = {
    present: { label: "Present", color: "bg-green-100 text-green-700", icon: CheckCircle2 },
    late: { label: "Late", color: "bg-yellow-100 text-yellow-700", icon: AlertCircle },
    absent: { label: "Absent", color: "bg-red-100 text-red-700", icon: XCircle },
    excused: { label: "Excused", color: "bg-gray-100 text-gray-700", icon: AlertCircle },
    no_show: { label: "No Show", color: "bg-red-100 text-red-700", icon: XCircle },
  };
  const c = config[status];
  const Icon = c.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium", c.color)}>
      <Icon className="h-3 w-3" /> {c.label}
    </span>
  );
}

function isJoinable(sessionDate: string, startTime: string): boolean {
  const now = new Date();
  const sessionStart = new Date(`${sessionDate}T${startTime}`);
  const diff = sessionStart.getTime() - now.getTime();
  const fifteenMin = 15 * 60 * 1000;
  return diff <= fifteenMin && diff > -4 * 60 * 60 * 1000; // joinable from 15 min before to 4 hours after
}

export default function ILTSessionsClient({ sessions: initialSessions }: ILTSessionsClientProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("upcoming");
  const [sessions, setSessions] = useState(initialSessions);

  const filtered = useMemo(() => {
    const now = new Date().toISOString().split("T")[0];
    switch (activeTab) {
      case "upcoming":
        return sessions.filter((s) => s.session_date >= now && s.status !== "completed" && s.status !== "cancelled");
      case "past":
        return sessions.filter((s) => s.session_date < now || s.status === "completed");
      default:
        return sessions;
    }
  }, [sessions, activeTab]);

  const [registeringId, setRegisteringId] = useState<string | null>(null);

  async function handleRegister(sessionId: string) {
    setRegisteringId(sessionId);
    try {
      const res = await fetch("/api/ilt-sessions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, action: "register" }),
      });

      if (!res.ok) {
        const data = await res.json();
        console.error("Registration failed:", data.error);
        setRegisteringId(null);
        return;
      }

      const data = await res.json();

      trackEvent("ilt_registered", { session_id: sessionId });

      // Optimistically update local state
      setSessions((prev) =>
        prev.map((s) =>
          s.id === sessionId
            ? {
                ...s,
                is_registered: true,
                registered_count: s.registered_count + 1,
              }
            : s
        )
      );
    } catch (err) {
      console.error("Registration error:", err);
    } finally {
      setRegisteringId(null);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <h1 className="text-2xl font-bold text-gray-900">Instructor-Led Training Sessions</h1>
        <p className="mt-1 text-gray-500">View upcoming sessions, register, and review past attendance.</p>

        {/* Tabs */}
        <div className="mt-6 border-b border-gray-200">
          <nav className="flex gap-6">
            {TABS.map((tab) => {
              const now = new Date().toISOString().split("T")[0];
              let count = 0;
              if (tab.key === "upcoming") {
                count = sessions.filter((s) => s.session_date >= now && s.status !== "completed" && s.status !== "cancelled").length;
              } else if (tab.key === "past") {
                count = sessions.filter((s) => s.session_date < now || s.status === "completed").length;
              } else {
                count = sessions.length;
              }
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    "relative pb-3 text-sm font-medium transition-colors",
                    activeTab === tab.key
                      ? "text-indigo-600"
                      : "text-gray-500 hover:text-gray-700"
                  )}
                >
                  {tab.label}
                  <span
                    className={cn(
                      "ml-1.5 rounded-full px-2 py-0.5 text-xs",
                      activeTab === tab.key
                        ? "bg-indigo-100 text-indigo-600"
                        : "bg-gray-100 text-gray-500"
                    )}
                  >
                    {count}
                  </span>
                  {activeTab === tab.key && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Session Cards */}
        {filtered.length > 0 ? (
          <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((session) => {
              const LocationIcon = LOCATION_ICONS[session.location_type];
              const capacityPercent = Math.min(
                (session.registered_count / session.max_capacity) * 100,
                100
              );
              const isFull = session.registered_count >= session.max_capacity;
              const canJoin =
                session.is_registered &&
                session.meeting_url &&
                (session.location_type === "virtual" || session.location_type === "hybrid") &&
                session.status === "scheduled" &&
                isJoinable(session.session_date, session.start_time);
              const isPast = session.status === "completed";

              // Parse date for prominent display
              const dateObj = new Date(session.session_date + "T00:00:00");
              const month = dateObj.toLocaleDateString("en-US", { month: "short" });
              const day = dateObj.getDate();

              return (
                <div
                  key={session.id}
                  className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-all hover:shadow-md"
                >
                  <div className="p-5">
                    <div className="flex gap-4">
                      {/* Date display */}
                      <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
                        <Calendar className="mb-1 h-4 w-4 text-indigo-600" />
                        <span className="text-xs font-medium uppercase text-gray-500">{month}</span>
                        <span className="text-2xl font-bold text-gray-900">{day}</span>
                      </div>

                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 truncate">{session.course_title}</h3>
                        <p className="mt-0.5 text-sm text-gray-600 truncate">{session.session_title}</p>

                        <div className="mt-2 space-y-1">
                          <div className="flex items-center gap-1.5 text-xs text-gray-500">
                            <Clock className="h-3.5 w-3.5 flex-shrink-0" />
                            {session.start_time} - {session.end_time} ({session.timezone.replace("America/", "")})
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-gray-500">
                            <LocationIcon className="h-3.5 w-3.5 flex-shrink-0" />
                            <span className="truncate">
                              {LOCATION_LABELS[session.location_type]} - {session.location_details}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-gray-500">
                            <User className="h-3.5 w-3.5 flex-shrink-0" />
                            {session.instructor_name}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Capacity Bar */}
                    <div className="mt-4">
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span>Capacity</span>
                        <span>
                          {session.registered_count}/{session.max_capacity}
                          {isFull && <span className="ml-1 text-red-600 font-medium">Full</span>}
                        </span>
                      </div>
                      <div className="mt-1 h-2 overflow-hidden rounded-full bg-gray-200">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            isFull ? "bg-red-500" : capacityPercent > 80 ? "bg-yellow-500" : "bg-green-500"
                          )}
                          style={{ width: `${capacityPercent}%` }}
                        />
                      </div>
                    </div>

                    {/* Past session info */}
                    {isPast && session.is_registered && (
                      <div className="mt-3 flex items-center gap-3">
                        <AttendanceBadge status={session.attendance_status} />
                        {session.completion_status === "completed" && (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700">
                            <CheckCircle2 className="h-3 w-3" /> Completed
                          </span>
                        )}
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="mt-4 flex gap-2">
                      {!isPast && session.is_registered && (
                        <>
                          {canJoin ? (
                            <a
                              href={session.meeting_url || "#"}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-green-600 py-2.5 text-sm font-semibold text-white hover:bg-green-700"
                            >
                              <ExternalLink className="h-4 w-4" /> Join Meeting
                            </a>
                          ) : (
                            <div className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-indigo-50 py-2.5 text-sm font-medium text-indigo-700">
                              <CheckCircle2 className="h-4 w-4" /> Registered
                            </div>
                          )}
                        </>
                      )}
                      {!isPast && !session.is_registered && (
                        <button
                          onClick={() => handleRegister(session.id)}
                          disabled={isFull || registeringId === session.id}
                          className={cn(
                            "flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition-colors",
                            isFull
                              ? "border border-yellow-300 bg-yellow-50 text-yellow-700"
                              : "bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
                          )}
                        >
                          {registeringId === session.id
                            ? "Registering..."
                            : isFull
                            ? "Join Waitlist"
                            : "Register"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="mt-12 flex flex-col items-center justify-center py-16">
            <Calendar className="h-16 w-16 text-gray-300" />
            <h3 className="mt-4 text-lg font-medium text-gray-900">No sessions found</h3>
            <p className="mt-1 text-sm text-gray-500">
              {activeTab === "upcoming"
                ? "There are no upcoming ILT sessions at this time."
                : activeTab === "past"
                ? "You have no past ILT session records."
                : "No sessions available."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
