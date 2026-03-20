"use client";

import { useState } from "react";

interface Stats {
  totalMentors: number;
  activeMentors: number;
  availableMentors: number;
  totalRequests: number;
  pendingRequests: number;
  activeRequests: number;
  completedRequests: number;
  totalSessions: number;
  completedSessions: number;
  avgRating: string;
  totalActiveMentees: number;
}

interface AdminMentorshipClientProps {
  stats: Stats;
  recentRequests: any[];
}

export default function AdminMentorshipClient({
  stats,
  recentRequests,
}: AdminMentorshipClientProps) {
  const [filter, setFilter] = useState<string>("all");

  const filtered =
    filter === "all"
      ? recentRequests
      : recentRequests.filter((r: any) => r.status === filter);

  const statusColors: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-700",
    matched: "bg-blue-100 text-blue-700",
    active: "bg-green-100 text-green-700",
    completed: "bg-gray-100 text-gray-600",
    cancelled: "bg-red-100 text-red-700",
  };

  const statCards = [
    { label: "Active Mentors", value: stats.activeMentors, sub: `${stats.availableMentors} available`, color: "bg-indigo-50 text-indigo-700" },
    { label: "Active Mentorships", value: stats.activeRequests, sub: `${stats.pendingRequests} pending`, color: "bg-green-50 text-green-700" },
    { label: "Total Sessions", value: stats.totalSessions, sub: `${stats.completedSessions} completed`, color: "bg-blue-50 text-blue-700" },
    { label: "Avg Rating", value: stats.avgRating, sub: `${stats.totalActiveMentees} active mentees`, color: "bg-amber-50 text-amber-700" },
    { label: "Completed", value: stats.completedRequests, sub: `of ${stats.totalRequests} total`, color: "bg-purple-50 text-purple-700" },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Mentorship Administration</h1>
        <p className="mt-1 text-sm text-gray-500">
          Overview of all mentorship activity and management tools
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 mb-8">
        {statCards.map((card) => (
          <div
            key={card.label}
            className={`rounded-xl border border-gray-200 ${card.color} p-5`}
          >
            <p className="text-xs font-medium uppercase tracking-wider opacity-70">
              {card.label}
            </p>
            <p className="mt-1 text-2xl font-bold">{card.value}</p>
            <p className="mt-0.5 text-xs opacity-60">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* Requests table */}
      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
          <h2 className="text-sm font-semibold text-gray-900">All Mentorship Requests</h2>
          <div className="flex gap-1">
            {["all", "pending", "matched", "active", "completed", "cancelled"].map((s) => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                  filter === s
                    ? "bg-indigo-100 text-indigo-700"
                    : "text-gray-500 hover:bg-gray-100"
                }`}
              >
                {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Mentee</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Mentor</th>
                <th className="px-5 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-5 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Match Score</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Goals</th>
                <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((req: any) => {
                const mentee = req.mentee as any;
                const mentor = req.mentor as any;
                return (
                  <tr key={req.id} className="hover:bg-gray-50/50">
                    <td className="px-5 py-3">
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {mentee?.first_name} {mentee?.last_name}
                        </p>
                        <p className="text-xs text-gray-500">{mentee?.email}</p>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      {mentor ? (
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {mentor.first_name} {mentor.last_name}
                          </p>
                          <p className="text-xs text-gray-500">{mentor.email}</p>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">Unmatched</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-center">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          statusColors[req.status] ?? "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {req.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-center">
                      {req.match_score ? (
                        <span className="text-sm font-medium text-indigo-600">
                          {parseFloat(req.match_score).toFixed(0)}%
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <p className="text-xs text-gray-500 max-w-[200px] truncate">
                        {req.goals || "-"}
                      </p>
                    </td>
                    <td className="px-5 py-3 text-right text-xs text-gray-500">
                      {new Date(req.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filtered.length === 0 && (
          <div className="p-8 text-center text-sm text-gray-400">
            No requests found for this filter
          </div>
        )}
      </div>
    </div>
  );
}
