"use client";

import { useState, useEffect } from "react";

interface DataPoint {
  snapshotDate: string;
  engagementScore: number;
  avgProgress?: number;
}

interface EngagementChartProps {
  userId?: string;
  days?: number;
  data?: DataPoint[];
  height?: number;
}

export default function EngagementChart({
  userId,
  days = 30,
  data: externalData,
  height = 200,
}: EngagementChartProps) {
  const [data, setData] = useState<DataPoint[]>(externalData ?? []);
  const [loading, setLoading] = useState(!externalData);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  useEffect(() => {
    if (externalData) {
      setData(externalData);
      return;
    }
    fetchData();
  }, [userId, days, externalData]);

  async function fetchData() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ days: String(days) });
      if (userId) params.set("user_id", userId);
      const res = await fetch(`/api/analytics/snapshots?${params}`);
      if (res.ok) {
        const json = await res.json();
        setData(json.snapshots ?? []);
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-gray-200 bg-white" style={{ height }}>
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-400" style={{ height }}>
        No engagement data yet
      </div>
    );
  }

  // Chart dimensions
  const padding = { top: 20, right: 20, bottom: 30, left: 40 };
  const chartWidth = 600;
  const chartHeight = height;
  const innerWidth = chartWidth - padding.left - padding.right;
  const innerHeight = chartHeight - padding.top - padding.bottom;

  const maxScore = Math.max(...data.map((d) => d.engagementScore), 100);
  const minScore = 0;

  // Build SVG path
  const points = data.map((d, i) => ({
    x: padding.left + (i / Math.max(data.length - 1, 1)) * innerWidth,
    y:
      padding.top +
      innerHeight -
      ((d.engagementScore - minScore) / (maxScore - minScore)) * innerHeight,
    ...d,
  }));

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
    .join(" ");

  const areaPath =
    linePath +
    ` L ${points[points.length - 1].x} ${padding.top + innerHeight} L ${points[0].x} ${padding.top + innerHeight} Z`;

  // Y-axis labels
  const yLabels = [0, 25, 50, 75, 100];

  // X-axis labels (show ~5 dates)
  const step = Math.max(Math.floor(data.length / 5), 1);
  const xLabels = data.filter((_, i) => i % step === 0 || i === data.length - 1);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-semibold text-gray-900">Engagement Over Time</h4>
        {hoveredIndex !== null && points[hoveredIndex] && (
          <div className="text-xs text-gray-500">
            {new Date(points[hoveredIndex].snapshotDate).toLocaleDateString()}:{" "}
            <span className="font-medium text-indigo-600">
              {points[hoveredIndex].engagementScore.toFixed(0)}
            </span>
          </div>
        )}
      </div>

      <svg
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        className="w-full"
        style={{ height }}
        onMouseLeave={() => setHoveredIndex(null)}
      >
        {/* Grid lines */}
        {yLabels.map((val) => {
          const y =
            padding.top +
            innerHeight -
            ((val - minScore) / (maxScore - minScore)) * innerHeight;
          return (
            <g key={val}>
              <line
                x1={padding.left}
                y1={y}
                x2={chartWidth - padding.right}
                y2={y}
                stroke="#f3f4f6"
                strokeWidth={1}
              />
              <text
                x={padding.left - 8}
                y={y + 4}
                textAnchor="end"
                className="text-[10px] fill-gray-400"
              >
                {val}
              </text>
            </g>
          );
        })}

        {/* X-axis labels */}
        {xLabels.map((d, i) => {
          const idx = data.indexOf(d);
          const x = padding.left + (idx / Math.max(data.length - 1, 1)) * innerWidth;
          return (
            <text
              key={i}
              x={x}
              y={chartHeight - 5}
              textAnchor="middle"
              className="text-[10px] fill-gray-400"
            >
              {new Date(d.snapshotDate).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
            </text>
          );
        })}

        {/* Gradient area */}
        <defs>
          <linearGradient id="engagementGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" stopOpacity={0.2} />
            <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#engagementGradient)" />

        {/* Line */}
        <path
          d={linePath}
          fill="none"
          stroke="#6366f1"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Interactive dots */}
        {points.map((p, i) => (
          <g key={i}>
            <circle
              cx={p.x}
              cy={p.y}
              r={hoveredIndex === i ? 5 : 3}
              fill={hoveredIndex === i ? "#6366f1" : "white"}
              stroke="#6366f1"
              strokeWidth={2}
              className="cursor-pointer transition-all"
              onMouseEnter={() => setHoveredIndex(i)}
            />
            {/* Invisible wider hit area */}
            <circle
              cx={p.x}
              cy={p.y}
              r={12}
              fill="transparent"
              onMouseEnter={() => setHoveredIndex(i)}
            />
          </g>
        ))}
      </svg>
    </div>
  );
}
