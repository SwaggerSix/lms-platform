"use client";

import { useState } from "react";
import RiskIndicator from "@/components/analytics/risk-indicator";
import EngagementChart from "@/components/analytics/engagement-chart";

interface MemberSummary {
  id: string;
  name: string;
  email: string;
  jobTitle: string | null;
  engagementScore: number;
  avgProgress: number;
  coursesEnrolled: number;
  coursesCompleted: number;
  loginStreak: number;
  riskLevel: "low" | "medium" | "high" | "critical";
  riskScore: number;
  riskCourse: string | null;
  recentSnapshots: any[];
}

interface ManagerAnalyticsClientProps {
  teamMembers: MemberSummary[];
  totalTeam: number;
}

export default function ManagerAnalyticsClient({
  teamMembers,
  totalTeam,
}: ManagerAnalyticsClientProps) {
  const [selectedMember, setSelectedMember] = useState<MemberSummary | null>(null);
  const [sortBy, setSortBy] = useState<"risk" | "engagement" | "name">("risk");

  const sorted = [...teamMembers].sort((a, b) => {
    if (sortBy === "risk") return b.riskScore - a.riskScore;
    if (sortBy === "engagement") return b.engagementScore - a.engagementScore;
    return a.name.localeCompare(b.name);
  });

  const avgEngagement =
    teamMembers.length > 0
      ? (teamMembers.reduce((s, m) => s + m.engagementScore, 0) / teamMembers.length).toFixed(0)
      : "0";

  const atRiskCount = teamMembers.filter(
    (m) => m.riskLevel === "high" || m.riskLevel === "critical"
  ).length;

  const avgCompletion =
    teamMembers.length > 0
      ? (
          teamMembers.reduce((s, m) => s + m.avgProgress, 0) / teamMembers.length
        ).toFixed(0)
      : "0";

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Team Analytics</h1>
        <p className="mt-1 text-sm text-gray-500">
          Risk overview and engagement trends for your direct reports
        </p>
      </div>

      {/* Overview stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Team Size</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{totalTeam}</p>
          <p className="mt-0.5 text-xs text-gray-400">direct reports</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Avg Engagement</p>
          <p className="mt-1 text-2xl font-bold text-indigo-600">{avgEngagement}%</p>
          <p className="mt-0.5 text-xs text-gray-400">team average</p>
        </div>
        <div className={`rounded-xl border p-5 ${atRiskCount > 0 ? "border-red-200 bg-red-50" : "border-gray-200 bg-white"}`}>
          <p className={`text-xs font-medium uppercase tracking-wider ${atRiskCount > 0 ? "text-red-600" : "text-gray-500"}`}>
            At Risk
          </p>
          <p className={`mt-1 text-2xl font-bold ${atRiskCount > 0 ? "text-red-700" : "text-gray-900"}`}>
            {atRiskCount}
          </p>
          <p className={`mt-0.5 text-xs ${atRiskCount > 0 ? "text-red-500" : "text-gray-400"}`}>
            need attention
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Avg Progress</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{avgCompletion}%</p>
          <p className="mt-0.5 text-xs text-gray-400">across courses</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Team list */}
        <div className="lg:col-span-2">
          <div className="rounded-xl border border-gray-200 bg-white">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
              <h2 className="text-sm font-semibold text-gray-900">Team Members</h2>
              <div className="flex gap-1">
                {[
                  { key: "risk", label: "By Risk" },
                  { key: "engagement", label: "By Engagement" },
                  { key: "name", label: "By Name" },
                ].map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => setSortBy(opt.key as any)}
                    className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                      sortBy === opt.key
                        ? "bg-indigo-100 text-indigo-700"
                        : "text-gray-500 hover:bg-gray-100"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {sorted.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-400">
                No direct reports found
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {sorted.map((member) => (
                  <button
                    key={member.id}
                    onClick={() =>
                      setSelectedMember(
                        selectedMember?.id === member.id ? null : member
                      )
                    }
                    className={`w-full px-5 py-3 text-left hover:bg-gray-50 transition-colors ${
                      selectedMember?.id === member.id ? "bg-indigo-50" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-gray-400 to-gray-600 flex items-center justify-center text-white text-xs font-bold">
                          {member.name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                            .toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {member.name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {member.jobTitle ?? member.email}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        {/* Engagement bar */}
                        <div className="hidden sm:flex items-center gap-2">
                          <div className="w-20 h-2 rounded-full bg-gray-100 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-indigo-500 transition-all"
                              style={{ width: `${member.engagementScore}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-500 w-8">
                            {member.engagementScore.toFixed(0)}%
                          </span>
                        </div>

                        {/* Risk badge */}
                        <RiskIndicator level={member.riskLevel} size="sm" />

                        {/* Stats */}
                        <div className="hidden md:flex items-center gap-3 text-xs text-gray-400">
                          <span>{member.coursesEnrolled} enrolled</span>
                          <span>{member.coursesCompleted} done</span>
                          {member.loginStreak > 0 && (
                            <span>{member.loginStreak}d streak</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {member.riskCourse && (member.riskLevel === "high" || member.riskLevel === "critical") && (
                      <div className="mt-1 ml-12 text-xs text-red-500">
                        Highest risk: {member.riskCourse} (score: {member.riskScore.toFixed(0)})
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Detail panel */}
        <div>
          {selectedMember ? (
            <div className="sticky top-24 space-y-4">
              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold">
                    {selectedMember.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">
                      {selectedMember.name}
                    </h3>
                    <p className="text-xs text-gray-500">
                      {selectedMember.jobTitle ?? selectedMember.email}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-gray-50 p-3 text-center">
                    <p className="text-xs text-gray-500">Engagement</p>
                    <p className="text-lg font-bold text-indigo-600">
                      {selectedMember.engagementScore.toFixed(0)}%
                    </p>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-3 text-center">
                    <p className="text-xs text-gray-500">Avg Progress</p>
                    <p className="text-lg font-bold text-gray-900">
                      {selectedMember.avgProgress.toFixed(0)}%
                    </p>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-3 text-center">
                    <p className="text-xs text-gray-500">Courses</p>
                    <p className="text-lg font-bold text-gray-900">
                      {selectedMember.coursesCompleted}/{selectedMember.coursesEnrolled}
                    </p>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-3 text-center">
                    <p className="text-xs text-gray-500">Risk</p>
                    <div className="mt-0.5 flex justify-center">
                      <RiskIndicator
                        level={selectedMember.riskLevel}
                        score={selectedMember.riskScore}
                        size="sm"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Engagement trend */}
              {selectedMember.recentSnapshots.length > 0 && (
                <EngagementChart
                  data={selectedMember.recentSnapshots.map((s: any) => ({
                    snapshotDate: s.snapshot_date,
                    engagementScore: parseFloat(s.engagement_score) || 0,
                  }))}
                  height={180}
                />
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-8 text-center">
              <svg className="mx-auto h-10 w-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
              <p className="mt-2 text-sm text-gray-400">
                Select a team member to view details
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
