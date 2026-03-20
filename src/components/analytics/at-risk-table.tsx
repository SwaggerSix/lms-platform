"use client";

import { useState } from "react";
import RiskIndicator from "./risk-indicator";

interface AtRiskLearner {
  userId: string;
  userName: string;
  email: string;
  courseId: string;
  courseTitle: string;
  riskLevel: "low" | "medium" | "high" | "critical";
  riskScore: number;
  factors: Record<string, number | string>;
  recommendedActions: string[];
  computedAt: string;
}

interface AtRiskTableProps {
  learners: AtRiskLearner[];
  onRefresh?: () => void;
  loading?: boolean;
}

export default function AtRiskTable({ learners, onRefresh, loading }: AtRiskTableProps) {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [sortField, setSortField] = useState<"riskScore" | "userName" | "courseTitle">("riskScore");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const sorted = [...learners].sort((a, b) => {
    const aVal = a[sortField];
    const bVal = b[sortField];
    if (typeof aVal === "number" && typeof bVal === "number") {
      return sortDir === "asc" ? aVal - bVal : bVal - aVal;
    }
    return sortDir === "asc"
      ? String(aVal).localeCompare(String(bVal))
      : String(bVal).localeCompare(String(aVal));
  });

  function toggleSort(field: typeof sortField) {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  }

  function SortIcon({ field }: { field: typeof sortField }) {
    if (sortField !== field) return <span className="text-gray-300 ml-1">&#8645;</span>;
    return <span className="text-indigo-600 ml-1">{sortDir === "asc" ? "&#8593;" : "&#8595;"}</span>;
  }

  function formatFactors(factors: Record<string, number | string>) {
    const entries = Object.entries(factors);
    if (entries.length === 0) return "No specific factors identified";
    return entries
      .map(([key, val]) => {
        const label = key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
        return `${label}: ${val}`;
      })
      .join(" | ");
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
        <div className="inline-flex items-center gap-2">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
          <span className="text-sm text-gray-500">Loading at-risk learners...</span>
        </div>
      </div>
    );
  }

  if (learners.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-green-50 p-8 text-center">
        <svg className="mx-auto h-10 w-10 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="mt-3 text-sm text-green-700 font-medium">No at-risk learners detected</p>
        <p className="mt-1 text-sm text-green-600">All learners are progressing well</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">At-Risk Learners</h3>
          <p className="text-xs text-gray-500">{learners.length} learner{learners.length !== 1 ? "s" : ""} need attention</p>
        </div>
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            Refresh
          </button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-100">
          <thead>
            <tr className="bg-gray-50/50">
              <th
                className="cursor-pointer px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                onClick={() => toggleSort("userName")}
              >
                Learner <SortIcon field="userName" />
              </th>
              <th
                className="cursor-pointer px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                onClick={() => toggleSort("courseTitle")}
              >
                Course <SortIcon field="courseTitle" />
              </th>
              <th
                className="cursor-pointer px-5 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider"
                onClick={() => toggleSort("riskScore")}
              >
                Risk <SortIcon field="riskScore" />
              </th>
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Key Factors
              </th>
              <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {sorted.map((learner) => {
              const rowKey = `${learner.userId}-${learner.courseId}`;
              const isExpanded = expandedRow === rowKey;
              return (
                <tr key={rowKey} className="group">
                  <td className="px-5 py-3">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{learner.userName}</p>
                      <p className="text-xs text-gray-500">{learner.email}</p>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <p className="text-sm text-gray-700 max-w-[200px] truncate">{learner.courseTitle}</p>
                  </td>
                  <td className="px-5 py-3 text-center">
                    <div className="flex justify-center">
                      <RiskIndicator level={learner.riskLevel} score={learner.riskScore} size="sm" />
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <p className="text-xs text-gray-500 max-w-[300px] truncate">
                      {formatFactors(learner.factors)}
                    </p>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => setExpandedRow(isExpanded ? null : rowKey)}
                      className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
                    >
                      {isExpanded ? "Hide" : "View Actions"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Expanded action panel */}
      {expandedRow && (() => {
        const [userId, courseId] = expandedRow.split("-");
        const learner = learners.find(
          (l) => `${l.userId}-${l.courseId}` === expandedRow
        );
        if (!learner) return null;

        return (
          <div className="border-t border-gray-200 bg-gray-50 px-5 py-4">
            <h4 className="text-sm font-medium text-gray-900 mb-2">
              Recommended Actions for {learner.userName}
            </h4>
            <ul className="space-y-2">
              {learner.recommendedActions.map((action, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-medium">
                    {i + 1}
                  </span>
                  <span className="text-sm text-gray-700">{action}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-gray-400">
              Last computed: {new Date(learner.computedAt).toLocaleString()}
            </p>
          </div>
        );
      })()}
    </div>
  );
}
