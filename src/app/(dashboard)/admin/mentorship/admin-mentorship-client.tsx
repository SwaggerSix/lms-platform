"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

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
  outcomes: {
    avgTimeToMatchDays: string | null;
    completionRatePct: number | null;
    goalsMetPct: number | null;
    wouldRecommendPct: number | null;
    engagementPct: number | null;
    engagedActive: number;
    activeCount: number;
    sessionsLast90d: number;
  };
  recentRequests: any[];
  mentors: any[];
  users: any[];
  circles: any[];
}

export default function AdminMentorshipClient({
  stats,
  outcomes,
  recentRequests,
  mentors,
  users,
  circles: initialCircles,
}: AdminMentorshipClientProps) {
  const router = useRouter();
  const [filter, setFilter] = useState<string>("all");
  const [mentorList, setMentorList] = useState<any[]>(mentors);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Assign-mentor dialog state
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignMentorId, setAssignMentorId] = useState("");
  const [assignMenteeId, setAssignMenteeId] = useState("");
  const [assignGoals, setAssignGoals] = useState("");
  const [assignType, setAssignType] = useState<"traditional" | "reverse" | "peer">("traditional");
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  // Circles state
  const [circles, setCircles] = useState<any[]>(initialCircles);

  // Keep local state in sync after router.refresh() so newly-created circles
  // and freshly-toggled mentors appear without a full reload.
  useEffect(() => {
    setCircles(initialCircles);
  }, [initialCircles]);
  useEffect(() => {
    setMentorList(mentors);
  }, [mentors]);
  const [circleOpen, setCircleOpen] = useState(false);
  const [circleName, setCircleName] = useState("");
  const [circleMentorId, setCircleMentorId] = useState("");
  const [circleDescription, setCircleDescription] = useState("");
  const [circleMaxMembers, setCircleMaxMembers] = useState(6);
  const [circleSaving, setCircleSaving] = useState(false);
  const [circleError, setCircleError] = useState<string | null>(null);
  const [addMemberCircleId, setAddMemberCircleId] = useState<string | null>(null);
  const [addMemberMenteeId, setAddMemberMenteeId] = useState("");

  function resetCircleForm() {
    setCircleOpen(false);
    setCircleName("");
    setCircleMentorId("");
    setCircleDescription("");
    setCircleMaxMembers(6);
    setCircleError(null);
  }

  async function submitCircle() {
    if (!circleName.trim() || !circleMentorId) {
      setCircleError("Name and mentor are required.");
      return;
    }
    setCircleSaving(true);
    setCircleError(null);
    try {
      const res = await fetch("/api/mentorship/circles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: circleName.trim(),
          mentor_id: circleMentorId,
          description: circleDescription.trim() || null,
          max_members: circleMaxMembers,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create circle");
      resetCircleForm();
      router.refresh();
    } catch (err: any) {
      setCircleError(err.message);
    } finally {
      setCircleSaving(false);
    }
  }

  async function addCircleMember(circleId: string, menteeId: string) {
    if (!menteeId) return;
    try {
      const res = await fetch(`/api/mentorship/circles/${circleId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mentee_id: menteeId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to add member");
      setAddMemberCircleId(null);
      setAddMemberMenteeId("");
      router.refresh();
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function removeCircleMember(circleId: string, menteeId: string) {
    if (!confirm("Remove this mentee from the circle?")) return;
    setCircles((prev) =>
      prev.map((c: any) =>
        c.id === circleId ? { ...c, members: (c.members ?? []).filter((m: any) => m.mentee_id !== menteeId) } : c
      )
    );
    try {
      const res = await fetch(`/api/mentorship/circles/${circleId}/members?mentee_id=${menteeId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
    } catch {
      alert("Failed to remove member.");
      router.refresh();
    }
  }

  // Mentors that can still take a mentee
  const assignableMentors = mentorList.filter(
    (m: any) => m.is_active && (m.current_mentee_count ?? 0) < (m.max_mentees ?? 0) && m.availability !== "unavailable"
  );

  function userName(u: any) {
    const name = `${u?.first_name ?? ""} ${u?.last_name ?? ""}`.trim();
    return name || u?.email || "Unknown";
  }

  function resetAssign() {
    setAssignOpen(false);
    setAssignMentorId("");
    setAssignMenteeId("");
    setAssignGoals("");
    setAssignError(null);
  }

  async function submitAssign() {
    if (!assignMentorId || !assignMenteeId) {
      setAssignError("Please choose both a mentor and a mentee.");
      return;
    }
    setAssigning(true);
    setAssignError(null);
    try {
      const res = await fetch("/api/mentorship/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mentor_id: assignMentorId,
          mentee_id: assignMenteeId,
          goals: assignGoals,
          mentorship_type: assignType,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to assign mentor");
      }
      resetAssign();
      router.refresh();
    } catch (err: any) {
      setAssignError(err.message);
    } finally {
      setAssigning(false);
    }
  }

  async function toggleActive(id: string, current: boolean) {
    setTogglingId(id);
    // Optimistic update
    setMentorList((prev) => prev.map((m) => (m.id === id ? { ...m, is_active: !current } : m)));
    try {
      const res = await fetch(`/api/mentorship/profiles/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !current }),
      });
      if (!res.ok) throw new Error("Request failed");
    } catch {
      // Revert on failure
      setMentorList((prev) => prev.map((m) => (m.id === id ? { ...m, is_active: current } : m)));
      alert("Failed to update mentor status. Please try again.");
    } finally {
      setTogglingId(null);
    }
  }

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
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mentorship Administration</h1>
          <p className="mt-1 text-sm text-gray-500">
            Overview of all mentorship activity and management tools
          </p>
        </div>
        <Button onClick={() => setAssignOpen(true)} className="shrink-0">
          Assign Mentor
        </Button>
      </div>

      {/* Assign mentor modal */}
      {assignOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={resetAssign}>
          <div
            className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-gray-900">Assign a Mentor</h3>
            <p className="mt-1 text-sm text-gray-500">
              Pair a mentee with an available mentor. This creates an active mentorship right away.
            </p>

            {assignError && (
              <div className="mt-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                {assignError}
              </div>
            )}

            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mentor *</label>
                <select
                  value={assignMentorId}
                  onChange={(e) => setAssignMentorId(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="">Select a mentor...</option>
                  {assignableMentors.map((m: any) => {
                    const open = (m.max_mentees ?? 0) - (m.current_mentee_count ?? 0);
                    return (
                      <option key={m.id} value={m.user_id}>
                        {userName(m.user)} ({open} spot{open === 1 ? "" : "s"} open)
                      </option>
                    );
                  })}
                </select>
                {assignableMentors.length === 0 && (
                  <p className="mt-1 text-xs text-amber-600">
                    No mentors with open capacity. Activate a mentor or free up capacity first.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mentee *</label>
                <select
                  value={assignMenteeId}
                  onChange={(e) => setAssignMenteeId(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="">Select a mentee...</option>
                  {users
                    .filter((u: any) => u.id !== assignMentorId)
                    .map((u: any) => (
                      <option key={u.id} value={u.id}>
                        {userName(u)} — {u.email}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mentorship type</label>
                <select
                  value={assignType}
                  onChange={(e) => setAssignType(e.target.value as "traditional" | "reverse" | "peer")}
                  className="mb-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="traditional">Traditional</option>
                  <option value="reverse">Reverse</option>
                  <option value="peer">Peer</option>
                </select>
                <label className="block text-sm font-medium text-gray-700 mb-1">Goals (optional)</label>
                <textarea
                  value={assignGoals}
                  onChange={(e) => setAssignGoals(e.target.value)}
                  rows={3}
                  placeholder="What should this mentorship focus on?"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <Button variant="outline" onClick={resetAssign} disabled={assigning}>
                Cancel
              </Button>
              <Button
                onClick={submitAssign}
                disabled={assigning || !assignMentorId || !assignMenteeId}
              >
                {assigning ? "Assigning..." : "Assign Mentor"}
              </Button>
            </div>
          </div>
        </div>
      )}

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

      {/* Program Outcomes */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Program Outcomes</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Avg time to match</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">
              {outcomes.avgTimeToMatchDays !== null ? `${outcomes.avgTimeToMatchDays} days` : "—"}
            </p>
            <p className="mt-0.5 text-xs text-gray-500">From request to matched_at</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Completion rate</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">
              {outcomes.completionRatePct !== null ? `${outcomes.completionRatePct}%` : "—"}
            </p>
            <p className="mt-0.5 text-xs text-gray-500">Completed vs. cancelled</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Goals met</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">
              {outcomes.goalsMetPct !== null ? `${outcomes.goalsMetPct}%` : "—"}
            </p>
            <p className="mt-0.5 text-xs text-gray-500">Per exit reviews</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Would recommend</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">
              {outcomes.wouldRecommendPct !== null ? `${outcomes.wouldRecommendPct}%` : "—"}
            </p>
            <p className="mt-0.5 text-xs text-gray-500">Per exit reviews</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Active engagement</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">
              {outcomes.engagementPct !== null ? `${outcomes.engagementPct}%` : "—"}
            </p>
            <p className="mt-0.5 text-xs text-gray-500">
              {outcomes.engagedActive} of {outcomes.activeCount} active met in last 30d
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Sessions (90d)</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">{outcomes.sessionsLast90d}</p>
            <p className="mt-0.5 text-xs text-gray-500">Completed in the last 90 days</p>
          </div>
        </div>
      </div>

      {/* Mentors table */}
      <div className="mb-8 rounded-xl border border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
          <h2 className="text-sm font-semibold text-gray-900">Mentors</h2>
          <span className="text-xs text-gray-500">{mentorList.length} total</span>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Mentor</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expertise</th>
                <th className="px-5 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Availability</th>
                <th className="px-5 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Mentees</th>
                <th className="px-5 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Rating</th>
                <th className="px-5 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {mentorList.map((mentor: any) => {
                const user = mentor.user as any;
                const expertise: string[] = Array.isArray(mentor.expertise_areas) ? mentor.expertise_areas : [];
                return (
                  <tr key={mentor.id} className="hover:bg-gray-50/50">
                    <td className="px-5 py-3">
                      <p className="text-sm font-medium text-gray-900">
                        {user?.first_name} {user?.last_name}
                      </p>
                      <p className="text-xs text-gray-500">{user?.job_title || user?.email}</p>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap gap-1 max-w-[260px]">
                        {expertise.length > 0 ? (
                          expertise.slice(0, 4).map((area, i) => (
                            <span key={i} className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                              {area}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                        {expertise.length > 4 && (
                          <span className="text-xs text-gray-400">+{expertise.length - 4}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-center text-xs text-gray-600 capitalize">
                      {mentor.availability || "-"}
                    </td>
                    <td className="px-5 py-3 text-center text-sm text-gray-600">
                      {mentor.current_mentee_count ?? 0}
                      {mentor.max_mentees ? ` / ${mentor.max_mentees}` : ""}
                    </td>
                    <td className="px-5 py-3 text-center text-sm text-gray-600">
                      {mentor.rating ? `${parseFloat(mentor.rating).toFixed(1)} (${mentor.total_reviews ?? 0})` : "-"}
                    </td>
                    <td className="px-5 py-3 text-center">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          mentor.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {mentor.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleActive(mentor.id, mentor.is_active)}
                        disabled={togglingId === mentor.id}
                      >
                        {mentor.is_active ? "Deactivate" : "Activate"}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {mentorList.length === 0 && (
          <div className="p-8 text-center text-sm text-gray-400">
            No mentor profiles yet. Mentors appear here once users create a profile.
          </div>
        )}
      </div>

      {/* Mentorship Circles */}
      <div className="mb-8 rounded-xl border border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Mentorship Circles</h2>
            <p className="text-xs text-gray-500 mt-0.5">One mentor leads a group of mentees.</p>
          </div>
          <Button size="sm" onClick={() => setCircleOpen(true)}>
            + New Circle
          </Button>
        </div>
        {circles.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">
            No circles yet. Create one to start a group mentorship.
          </div>
        ) : (
          <ul className="divide-y divide-gray-50">
            {circles.map((c: any) => {
              const mentor = c.mentor as any;
              const mentorName = `${mentor?.first_name ?? ""} ${mentor?.last_name ?? ""}`.trim() || mentor?.email || "—";
              const memberRows = (c.members ?? []) as any[];
              const full = memberRows.length >= (c.max_members ?? 0);
              return (
                <li key={c.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{c.name}</p>
                      <p className="text-xs text-gray-500">
                        Mentor: {mentorName} · {memberRows.length}/{c.max_members} members
                      </p>
                      {c.description && (
                        <p className="mt-1 text-xs text-gray-600">{c.description}</p>
                      )}
                    </div>
                    {!full && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setAddMemberCircleId(c.id)}
                        className="shrink-0"
                      >
                        + Add Member
                      </Button>
                    )}
                  </div>

                  {addMemberCircleId === c.id && (
                    <div className="mt-3 flex items-end gap-2 rounded-lg bg-gray-50 p-3">
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-gray-700 mb-1">Mentee</label>
                        <select
                          value={addMemberMenteeId}
                          onChange={(e) => setAddMemberMenteeId(e.target.value)}
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                        >
                          <option value="">Select a mentee...</option>
                          {users
                            .filter((u: any) =>
                              u.id !== c.mentor_id &&
                              !memberRows.some((m: any) => m.mentee_id === u.id)
                            )
                            .map((u: any) => (
                              <option key={u.id} value={u.id}>
                                {`${u.first_name ?? ""} ${u.last_name ?? ""}`.trim() || u.email} — {u.email}
                              </option>
                            ))}
                        </select>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => addCircleMember(c.id, addMemberMenteeId)}
                        disabled={!addMemberMenteeId}
                      >
                        Add
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => { setAddMemberCircleId(null); setAddMemberMenteeId(""); }}
                      >
                        Cancel
                      </Button>
                    </div>
                  )}

                  {memberRows.length > 0 && (
                    <ul className="mt-3 flex flex-wrap gap-2">
                      {memberRows.map((m: any) => {
                        const mn = m.mentee as any;
                        const name = `${mn?.first_name ?? ""} ${mn?.last_name ?? ""}`.trim() || mn?.email || "Mentee";
                        return (
                          <li key={m.mentee_id} className="inline-flex items-center gap-2 rounded-full bg-indigo-50 pl-3 pr-2 py-0.5 text-xs text-indigo-700">
                            <span>{name}</span>
                            <button
                              onClick={() => removeCircleMember(c.id, m.mentee_id)}
                              className="text-indigo-500 hover:text-indigo-700"
                              aria-label="Remove member"
                            >
                              ×
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Create-circle modal */}
      {circleOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={resetCircleForm}>
          <div
            className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-gray-900">New Mentorship Circle</h3>
            {circleError && (
              <div className="mt-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">{circleError}</div>
            )}
            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input
                  type="text"
                  value={circleName}
                  onChange={(e) => setCircleName(e.target.value)}
                  maxLength={200}
                  placeholder="e.g. Q1 Emerging Leaders"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mentor *</label>
                <select
                  value={circleMentorId}
                  onChange={(e) => setCircleMentorId(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="">Select a mentor...</option>
                  {mentorList
                    .filter((m: any) => m.is_active)
                    .map((m: any) => {
                      const u = m.user as any;
                      const name = `${u?.first_name ?? ""} ${u?.last_name ?? ""}`.trim() || u?.email || "—";
                      return <option key={m.id} value={m.user_id}>{name}</option>;
                    })}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
                <textarea
                  value={circleDescription}
                  onChange={(e) => setCircleDescription(e.target.value)}
                  rows={2}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Max members</label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={circleMaxMembers}
                  onChange={(e) => setCircleMaxMembers(Number(e.target.value) || 6)}
                  className="w-32 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <Button variant="outline" onClick={resetCircleForm} disabled={circleSaving}>
                Cancel
              </Button>
              <Button
                onClick={submitCircle}
                disabled={circleSaving || !circleName.trim() || !circleMentorId}
              >
                {circleSaving ? "Creating..." : "Create Circle"}
              </Button>
            </div>
          </div>
        </div>
      )}

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
