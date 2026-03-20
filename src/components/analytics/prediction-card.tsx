"use client";

import RiskIndicator from "./risk-indicator";

interface PredictionCardProps {
  prediction: {
    id: string;
    user_id: string;
    course_id: string;
    risk_level: "low" | "medium" | "high" | "critical";
    risk_score: number;
    factors: Record<string, number | string>;
    recommended_actions: string[];
    computed_at: string;
    course?: {
      id: string;
      title: string;
      slug?: string;
    };
  };
}

export default function PredictionCard({ prediction }: PredictionCardProps) {
  const factorEntries = Object.entries(prediction.factors).filter(
    ([, val]) => val !== undefined && val !== null && val !== ""
  );

  const factorLabels: Record<string, string> = {
    low_progress: "Progress",
    days_since_enroll: "Days Since Enrollment",
    overdue_days: "Overdue By",
    days_until_due: "Days Until Due",
    remaining_progress: "Remaining Progress",
    days_since_last_access: "Days Since Last Access",
    never_accessed: "Never Accessed",
    avg_assessment_score: "Avg Assessment Score",
    engagement_declining: "Engagement Trend",
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-gray-900 truncate">
            {prediction.course?.title ?? "Unknown Course"}
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Updated {new Date(prediction.computed_at).toLocaleDateString()}
          </p>
        </div>
        <RiskIndicator
          level={prediction.risk_level}
          score={parseFloat(String(prediction.risk_score))}
          size="md"
        />
      </div>

      {/* Risk factors */}
      {factorEntries.length > 0 && (
        <div className="mt-4">
          <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
            Risk Factors
          </h4>
          <div className="space-y-1.5">
            {factorEntries.map(([key, value]) => (
              <div key={key} className="flex items-center justify-between">
                <span className="text-xs text-gray-600">
                  {factorLabels[key] ?? key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                </span>
                <span className="text-xs font-medium text-gray-900">
                  {typeof value === "number"
                    ? key.includes("score") || key.includes("progress")
                      ? `${value}%`
                      : key.includes("days")
                      ? `${value}d`
                      : value
                    : String(value)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Factor severity bars */}
      {factorEntries.length > 0 && (
        <div className="mt-3">
          <div className="flex gap-0.5">
            {factorEntries.slice(0, 5).map(([key], i) => {
              const barColor =
                prediction.risk_level === "critical"
                  ? "bg-red-400"
                  : prediction.risk_level === "high"
                  ? "bg-orange-400"
                  : prediction.risk_level === "medium"
                  ? "bg-yellow-400"
                  : "bg-green-400";
              return (
                <div
                  key={key}
                  className={`h-1 flex-1 rounded-full ${barColor}`}
                  style={{ opacity: 1 - i * 0.15 }}
                />
              );
            })}
            {Array.from({ length: Math.max(0, 5 - factorEntries.length) }).map((_, i) => (
              <div key={`empty-${i}`} className="h-1 flex-1 rounded-full bg-gray-100" />
            ))}
          </div>
        </div>
      )}

      {/* Recommended actions */}
      {prediction.recommended_actions.length > 0 && (
        <div className="mt-4">
          <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
            Recommendations
          </h4>
          <ul className="space-y-1.5">
            {prediction.recommended_actions.slice(0, 3).map((action, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-gray-600">
                <svg className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
                {action}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
