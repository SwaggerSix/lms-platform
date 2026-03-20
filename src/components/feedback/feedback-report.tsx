"use client";

import { useState, useMemo } from "react";

interface CompetencyScore {
  competency_id: string;
  name: string;
  average: number;
  count: number;
}

interface FeedbackReportProps {
  cycleName: string;
  subjectName: string;
  summary: {
    total_responses: number;
    by_relationship: Record<string, number>;
  };
  competencyScores: CompetencyScore[];
  comments: Array<{ relationship: string; text: string }>;
  ratingAverages: Record<string, number>;
}

function RadarChart({
  data,
  size = 300,
}: {
  data: { label: string; value: number; max: number }[];
  size?: number;
}) {
  const center = size / 2;
  const radius = size / 2 - 40;
  const angleStep = (2 * Math.PI) / data.length;

  const points = data.map((d, i) => {
    const angle = i * angleStep - Math.PI / 2;
    const r = (d.value / d.max) * radius;
    return {
      x: center + r * Math.cos(angle),
      y: center + r * Math.sin(angle),
      labelX: center + (radius + 24) * Math.cos(angle),
      labelY: center + (radius + 24) * Math.sin(angle),
      label: d.label,
      value: d.value,
    };
  });

  const gridLevels = [0.2, 0.4, 0.6, 0.8, 1.0];

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-[400px] mx-auto">
      {/* Grid lines */}
      {gridLevels.map((level) => {
        const gridPoints = data.map((_, i) => {
          const angle = i * angleStep - Math.PI / 2;
          const r = level * radius;
          return `${center + r * Math.cos(angle)},${center + r * Math.sin(angle)}`;
        });
        return (
          <polygon
            key={level}
            points={gridPoints.join(" ")}
            fill="none"
            stroke="#e5e7eb"
            strokeWidth="1"
          />
        );
      })}

      {/* Axis lines */}
      {data.map((_, i) => {
        const angle = i * angleStep - Math.PI / 2;
        return (
          <line
            key={i}
            x1={center}
            y1={center}
            x2={center + radius * Math.cos(angle)}
            y2={center + radius * Math.sin(angle)}
            stroke="#e5e7eb"
            strokeWidth="1"
          />
        );
      })}

      {/* Data polygon */}
      <polygon
        points={points.map((p) => `${p.x},${p.y}`).join(" ")}
        fill="rgba(99, 102, 241, 0.2)"
        stroke="#6366f1"
        strokeWidth="2"
      />

      {/* Data points */}
      {points.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r="4"
          fill="#6366f1"
          stroke="white"
          strokeWidth="2"
        />
      ))}

      {/* Labels */}
      {points.map((p, i) => (
        <text
          key={i}
          x={p.labelX}
          y={p.labelY}
          textAnchor="middle"
          dominantBaseline="middle"
          className="text-[10px] fill-gray-600 font-medium"
        >
          {p.label.length > 14 ? p.label.slice(0, 12) + ".." : p.label}
        </text>
      ))}

      {/* Score labels */}
      {points.map((p, i) => (
        <text
          key={`score-${i}`}
          x={p.x}
          y={p.y - 12}
          textAnchor="middle"
          className="text-[9px] fill-indigo-700 font-bold"
        >
          {p.value.toFixed(1)}
        </text>
      ))}
    </svg>
  );
}

function ScoreBar({ label, score, max = 5 }: { label: string; score: number; max?: number }) {
  const pct = (score / max) * 100;
  const color =
    score >= 4 ? "bg-green-500" : score >= 3 ? "bg-blue-500" : score >= 2 ? "bg-amber-500" : "bg-red-500";

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-gray-700">{label}</span>
        <span className="font-semibold text-gray-900">{score.toFixed(1)}/{max}</span>
      </div>
      <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function FeedbackReport({
  cycleName,
  subjectName,
  summary,
  competencyScores,
  comments,
  ratingAverages,
}: FeedbackReportProps) {
  const [commentFilter, setCommentFilter] = useState<string>("all");

  const overallAverage = useMemo(() => {
    const values = Object.values(ratingAverages);
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }, [ratingAverages]);

  const radarData = useMemo(() => {
    return competencyScores.map((c) => ({
      label: c.name,
      value: c.average,
      max: 5,
    }));
  }, [competencyScores]);

  const filteredComments = useMemo(() => {
    if (commentFilter === "all") return comments;
    return comments.filter((c) => c.relationship === commentFilter);
  }, [comments, commentFilter]);

  const relationshipColors: Record<string, string> = {
    self: "bg-blue-100 text-blue-700",
    peer: "bg-green-100 text-green-700",
    manager: "bg-purple-100 text-purple-700",
    direct_report: "bg-amber-100 text-amber-700",
    external: "bg-gray-100 text-gray-700",
    anonymous: "bg-gray-100 text-gray-600",
  };

  if (summary.total_responses === 0) {
    return (
      <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
        <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <h3 className="text-lg font-medium text-gray-900">No feedback yet</h3>
        <p className="text-gray-500 mt-1">Responses will appear here once reviewers submit their feedback.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl p-6 text-white">
        <p className="text-indigo-200 text-sm font-medium">{cycleName}</p>
        <h2 className="text-2xl font-bold mt-1">Feedback Report for {subjectName}</h2>
        <div className="flex items-center gap-6 mt-4">
          <div>
            <p className="text-indigo-200 text-xs uppercase tracking-wide">Overall Score</p>
            <p className="text-3xl font-bold">{overallAverage.toFixed(1)}<span className="text-lg text-indigo-200">/5</span></p>
          </div>
          <div className="h-12 w-px bg-indigo-400" />
          <div>
            <p className="text-indigo-200 text-xs uppercase tracking-wide">Responses</p>
            <p className="text-3xl font-bold">{summary.total_responses}</p>
          </div>
          <div className="h-12 w-px bg-indigo-400" />
          <div>
            <p className="text-indigo-200 text-xs uppercase tracking-wide">Breakdown</p>
            <div className="flex gap-2 mt-1">
              {Object.entries(summary.by_relationship).map(([rel, count]) => (
                <span key={rel} className="bg-white/20 px-2 py-0.5 rounded text-xs">
                  {rel}: {count}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Competency Radar Chart */}
      {competencyScores.length >= 3 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Competency Overview</h3>
          <RadarChart data={radarData} size={320} />
        </div>
      )}

      {/* Competency Scores */}
      {competencyScores.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Competency Scores</h3>
          <div className="space-y-4">
            {competencyScores
              .sort((a, b) => b.average - a.average)
              .map((c) => (
                <ScoreBar key={c.competency_id} label={c.name} score={c.average} />
              ))}
          </div>
        </div>
      )}

      {/* Rating Averages */}
      {Object.keys(ratingAverages).length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Question Ratings</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {Object.entries(ratingAverages).map(([qId, avg]) => (
              <div key={qId} className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-2xl font-bold text-indigo-600">{avg.toFixed(1)}</p>
                <p className="text-xs text-gray-500 mt-1">Q{qId.slice(-4)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Comments */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Comments & Qualitative Feedback</h3>
          <select
            value={commentFilter}
            onChange={(e) => setCommentFilter(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Sources</option>
            <option value="anonymous">Anonymous</option>
            <option value="self">Self</option>
            <option value="peer">Peer</option>
            <option value="manager">Manager</option>
            <option value="direct_report">Direct Report</option>
          </select>
        </div>

        {filteredComments.length === 0 ? (
          <p className="text-gray-500 text-sm py-4">No comments for this filter.</p>
        ) : (
          <div className="space-y-3">
            {filteredComments.map((c, i) => (
              <div key={i} className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium flex-shrink-0 ${
                    relationshipColors[c.relationship] || "bg-gray-100 text-gray-600"
                  }`}
                >
                  {c.relationship}
                </span>
                <p className="text-sm text-gray-700 leading-relaxed">{c.text}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
