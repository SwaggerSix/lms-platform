"use client";

import { useState } from "react";
import AtRiskTable from "@/components/analytics/at-risk-table";
import RiskIndicator from "@/components/analytics/risk-indicator";

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

interface PredictiveClientProps {
  atRiskLearners: AtRiskLearner[];
  alerts: any[];
  distribution: { low: number; medium: number; high: number; critical: number };
  avgRiskScore: string;
  totalPredictions: number;
}

export default function PredictiveAnalyticsClient({
  atRiskLearners,
  alerts: initialAlerts,
  distribution,
  avgRiskScore,
  totalPredictions,
}: PredictiveClientProps) {
  const [alerts, setAlerts] = useState(initialAlerts);
  const [activeTab, setActiveTab] = useState<"overview" | "learners" | "alerts">("overview");

  async function dismissAlert(alertId: string) {
    try {
      await fetch("/api/analytics/alerts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: alertId, is_dismissed: true }),
      });
      setAlerts((prev) => prev.filter((a) => a.id !== alertId));
    } catch {
      // ignore
    }
  }

  async function markAlertRead(alertId: string) {
    try {
      await fetch("/api/analytics/alerts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: alertId, is_read: true }),
      });
      setAlerts((prev) =>
        prev.map((a) => (a.id === alertId ? { ...a, is_read: true } : a))
      );
    } catch {
      // ignore
    }
  }

  const total = distribution.low + distribution.medium + distribution.high + distribution.critical;

  const alertTypeColors: Record<string, string> = {
    at_risk: "bg-red-50 border-red-200 text-red-700",
    disengaged: "bg-orange-50 border-orange-200 text-orange-700",
    behind_schedule: "bg-yellow-50 border-yellow-200 text-yellow-700",
    high_performer: "bg-green-50 border-green-200 text-green-700",
  };

  const alertTypeLabels: Record<string, string> = {
    at_risk: "At Risk",
    disengaged: "Disengaged",
    behind_schedule: "Behind Schedule",
    high_performer: "High Performer",
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Predictive Analytics</h1>
        <p className="mt-1 text-sm text-gray-500">
          Identify at-risk learners and take proactive interventions
        </p>
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="-mb-px flex gap-6">
          {[
            { key: "overview", label: "Overview" },
            { key: "learners", label: `At-Risk Learners (${atRiskLearners.length})` },
            { key: "alerts", label: `Alerts (${alerts.filter((a: any) => !a.is_read).length})` },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`whitespace-nowrap border-b-2 px-1 pb-3 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Overview Tab */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Stats */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Predictions</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">{totalPredictions}</p>
              <p className="mt-0.5 text-xs text-gray-400">Across all courses</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Avg Risk Score</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">{avgRiskScore}</p>
              <p className="mt-0.5 text-xs text-gray-400">Out of 100</p>
            </div>
            <div className="rounded-xl border border-red-200 bg-red-50 p-5">
              <p className="text-xs font-medium text-red-600 uppercase tracking-wider">Critical + High Risk</p>
              <p className="mt-1 text-2xl font-bold text-red-700">
                {distribution.critical + distribution.high}
              </p>
              <p className="mt-0.5 text-xs text-red-500">Need immediate attention</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Unread Alerts</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {alerts.filter((a: any) => !a.is_read).length}
              </p>
              <p className="mt-0.5 text-xs text-gray-400">Pending review</p>
            </div>
          </div>

          {/* Risk Distribution */}
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Risk Distribution</h3>
            {total > 0 ? (
              <div className="space-y-3">
                {(["critical", "high", "medium", "low"] as const).map((level) => {
                  const count = distribution[level];
                  const pct = total > 0 ? (count / total) * 100 : 0;
                  const colors: Record<string, { bar: string; bg: string; text: string }> = {
                    critical: { bar: "bg-red-500", bg: "bg-red-50", text: "text-red-700" },
                    high: { bar: "bg-orange-500", bg: "bg-orange-50", text: "text-orange-700" },
                    medium: { bar: "bg-yellow-500", bg: "bg-yellow-50", text: "text-yellow-700" },
                    low: { bar: "bg-green-500", bg: "bg-green-50", text: "text-green-700" },
                  };
                  const c = colors[level];

                  return (
                    <div key={level} className="flex items-center gap-3">
                      <div className="w-20">
                        <RiskIndicator level={level} size="sm" />
                      </div>
                      <div className="flex-1">
                        <div className={`h-6 rounded-full ${c.bg} overflow-hidden`}>
                          <div
                            className={`h-full rounded-full ${c.bar} transition-all duration-500`}
                            style={{ width: `${Math.max(pct, 1)}%` }}
                          />
                        </div>
                      </div>
                      <div className="w-16 text-right">
                        <span className={`text-sm font-medium ${c.text}`}>{count}</span>
                        <span className="text-xs text-gray-400 ml-1">({pct.toFixed(0)}%)</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-gray-400">No predictions computed yet. Run the daily analytics cron.</p>
            )}
          </div>

          {/* Risk heatmap-style summary */}
          {atRiskLearners.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Risk Heatmap</h3>
              <div className="grid gap-2 grid-cols-5 sm:grid-cols-8 lg:grid-cols-12">
                {atRiskLearners.slice(0, 24).map((l, i) => {
                  const bgColor =
                    l.riskLevel === "critical"
                      ? "bg-red-500"
                      : l.riskLevel === "high"
                      ? "bg-orange-400"
                      : "bg-yellow-400";
                  return (
                    <div
                      key={i}
                      className={`${bgColor} rounded-lg p-2 text-white text-center`}
                      title={`${l.userName}: ${l.riskScore}% risk - ${l.courseTitle}`}
                    >
                      <p className="text-[10px] font-medium truncate">{l.userName.split(" ")[0]}</p>
                      <p className="text-xs font-bold">{Math.round(l.riskScore)}</p>
                    </div>
                  );
                })}
              </div>
              {atRiskLearners.length > 24 && (
                <p className="mt-2 text-xs text-gray-400">
                  + {atRiskLearners.length - 24} more at-risk learners
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Learners Tab */}
      {activeTab === "learners" && (
        <AtRiskTable learners={atRiskLearners} />
      )}

      {/* Alerts Tab */}
      {activeTab === "alerts" && (
        <div className="space-y-3">
          {alerts.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-12 text-center">
              <p className="text-sm text-gray-500">No alerts</p>
            </div>
          ) : (
            alerts.map((alert: any) => {
              const u = alert.user as any;
              const c = alert.course as any;
              return (
                <div
                  key={alert.id}
                  className={`rounded-xl border p-4 ${
                    alert.is_read
                      ? "bg-white border-gray-200"
                      : alertTypeColors[alert.alert_type] ?? "bg-gray-50 border-gray-200"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            alertTypeColors[alert.alert_type] ?? "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {alertTypeLabels[alert.alert_type] ?? alert.alert_type}
                        </span>
                        {!alert.is_read && (
                          <span className="w-2 h-2 rounded-full bg-blue-500" />
                        )}
                      </div>
                      <p className="mt-1 text-sm text-gray-900">
                        <span className="font-medium">
                          {u ? `${u.first_name} ${u.last_name}` : "Unknown User"}
                        </span>
                        {c && <span className="text-gray-500"> in {c.title}</span>}
                      </p>
                      <p className="mt-0.5 text-xs text-gray-500">{alert.message}</p>
                      <p className="mt-1 text-xs text-gray-400">
                        {new Date(alert.created_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex gap-2 ml-4">
                      {!alert.is_read && (
                        <button
                          onClick={() => markAlertRead(alert.id)}
                          className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                        >
                          Mark Read
                        </button>
                      )}
                      <button
                        onClick={() => dismissAlert(alert.id)}
                        className="text-xs text-gray-400 hover:text-gray-600"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
