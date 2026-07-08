"use client";

import { useState } from "react";
import { MoreVertical } from "lucide-react";
import { cn } from "@/utils/cn";
import { formatDate } from "@/utils/format";
import { LOCATION_ICONS, STATUS_CONFIG, type SessionItem } from "./sessions-shared";

interface SessionsListProps {
  sessions: SessionItem[];
  onSelect: (session: SessionItem) => void;
  onCancel: (sessionId: string) => void;
  onDelete: (sessionId: string) => void;
}

export default function SessionsList({ sessions, onSelect, onCancel, onDelete }: SessionsListProps) {
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);

  return (
    <div className="mt-4 rounded-xl border border-gray-200 bg-white">
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
        <tbody className="divide-y divide-gray-100 [&>tr>td]:py-5">
          {sessions.map((session) => {
            const LocationIcon = LOCATION_ICONS[session.location_type];
            return (
              <tr
                key={session.id}
                className="cursor-pointer hover:bg-gray-50"
                onClick={() => onSelect(session)}
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
                            onSelect(session);
                            setActionMenuId(null);
                          }}
                          className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                        >
                          View Roster
                        </button>
                        {session.status === "scheduled" && (
                          <button
                            onClick={() => {
                              onCancel(session.id);
                              setActionMenuId(null);
                            }}
                            className="w-full px-4 py-2 text-left text-sm text-yellow-700 hover:bg-gray-50"
                          >
                            Cancel Session
                          </button>
                        )}
                        {session.status === "cancelled" && (
                          <button
                            onClick={() => {
                              onDelete(session.id);
                              setActionMenuId(null);
                            }}
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
          {sessions.length === 0 && (
            <tr>
              <td colSpan={9} className="px-4 !py-12 text-center text-gray-500">
                No sessions found matching your criteria.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
