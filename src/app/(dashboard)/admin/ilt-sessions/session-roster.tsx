"use client";

import { useState } from "react";
import {
  Calendar,
  CheckCircle2,
  ChevronLeft,
  Clock,
  Copy,
  Loader2,
  Send,
  UserCheck,
  UserX,
  Video,
  XCircle,
} from "lucide-react";
import { cn } from "@/utils/cn";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/utils/format";
import type { AttendanceStatus } from "@/types/database";
import {
  ATTENDANCE_OPTIONS,
  LOCATION_ICONS,
  PROVIDER_BADGES,
  STATUS_CONFIG,
  type SessionItem,
} from "./sessions-shared";

interface SessionRosterProps {
  session: SessionItem;
  onBack: () => void;
  onUpdateAttendance: (sessionId: string, attendeeId: string, status: AttendanceStatus) => void;
  onBulkMarkAttendance: (sessionId: string, status: AttendanceStatus) => void;
}

export default function SessionRoster({
  session,
  onBack,
  onUpdateAttendance,
  onBulkMarkAttendance,
}: SessionRosterProps) {
  const [sendingInvites, setSendingInvites] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const LocationIcon = LOCATION_ICONS[session.location_type];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <button
          onClick={onBack}
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

          {/* Meeting info */}
          {session.meeting_url && (
            <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-gray-100 pt-4">
              {session.meeting_provider && PROVIDER_BADGES[session.meeting_provider] && (
                <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium", PROVIDER_BADGES[session.meeting_provider].color)}>
                  <Video className="h-3 w-3" />
                  {PROVIDER_BADGES[session.meeting_provider].label}
                </span>
              )}
              <div className="flex items-center gap-2">
                <a
                  href={session.meeting_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary-600 hover:text-primary-700 truncate max-w-xs"
                >
                  {session.meeting_url}
                </a>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(session.meeting_url!);
                    setCopiedUrl(true);
                    setTimeout(() => setCopiedUrl(false), 2000);
                  }}
                  className="shrink-0 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                  title="Copy meeting URL"
                >
                  {copiedUrl ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
              </div>
              {session.meeting_password && (
                <span className="text-xs text-gray-500">
                  Password: <code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono">{session.meeting_password}</code>
                </span>
              )}
            </div>
          )}

          {/* Recording URL & Send Invites */}
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              onClick={async () => {
                setSendingInvites(true);
                // Download ICS for each attendee (in practice this would email them)
                // For now, trigger the ICS download as a demonstration
                try {
                  const link = document.createElement("a");
                  link.href = `/api/ilt-sessions/${session.id}/calendar`;
                  link.download = `${session.title.replace(/[^a-zA-Z0-9_-]/g, "_")}.ics`;
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                } catch (err) {
                  console.error("Failed to generate calendar invite:", err);
                } finally {
                  setTimeout(() => setSendingInvites(false), 1500);
                }
              }}
              disabled={sendingInvites || session.attendees.length === 0}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {sendingInvites ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              {sendingInvites ? "Generating..." : "Send Calendar Invites"}
            </button>
          </div>
        </div>

        {/* Bulk actions */}
        <div className="mt-4 flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">Bulk mark unmarked as:</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onBulkMarkAttendance(session.id, "present")}
          >
            <UserCheck className="h-3.5 w-3.5 text-green-600" /> Present
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onBulkMarkAttendance(session.id, "absent")}
          >
            <UserX className="h-3.5 w-3.5 text-red-600" /> Absent
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onBulkMarkAttendance(session.id, "no_show")}
          >
            <XCircle className="h-3.5 w-3.5 text-orange-600" /> No Show
          </Button>
        </div>

        {/* Roster Table */}
        <div className="mt-4 rounded-xl border border-gray-200 bg-white">
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
                        onUpdateAttendance(session.id, attendee.id, e.target.value as AttendanceStatus)
                      }
                      className={cn(
                        "rounded-lg border border-gray-300 px-2 py-1 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500",
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
                  <td className="px-4 py-3 text-gray-600">{attendee.check_in_time || "—"}</td>
                  <td className="px-4 py-3 text-gray-600">{attendee.notes || "—"}</td>
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
