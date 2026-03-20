"use client";

interface RiskIndicatorProps {
  level: "low" | "medium" | "high" | "critical";
  score?: number;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}

const levelConfig = {
  low: {
    color: "bg-green-500",
    bgColor: "bg-green-50",
    textColor: "text-green-700",
    borderColor: "border-green-200",
    label: "Low Risk",
    ringColor: "ring-green-500/20",
  },
  medium: {
    color: "bg-yellow-500",
    bgColor: "bg-yellow-50",
    textColor: "text-yellow-700",
    borderColor: "border-yellow-200",
    label: "Medium Risk",
    ringColor: "ring-yellow-500/20",
  },
  high: {
    color: "bg-orange-500",
    bgColor: "bg-orange-50",
    textColor: "text-orange-700",
    borderColor: "border-orange-200",
    label: "High Risk",
    ringColor: "ring-orange-500/20",
  },
  critical: {
    color: "bg-red-500",
    bgColor: "bg-red-50",
    textColor: "text-red-700",
    borderColor: "border-red-200",
    label: "Critical",
    ringColor: "ring-red-500/20",
  },
};

export default function RiskIndicator({
  level,
  score,
  size = "md",
  showLabel = true,
}: RiskIndicatorProps) {
  const config = levelConfig[level];

  const sizeClasses = {
    sm: "h-6 text-xs px-2",
    md: "h-8 text-sm px-3",
    lg: "h-10 text-base px-4",
  };

  const meterSizes = {
    sm: { width: 40, height: 40, stroke: 4 },
    md: { width: 56, height: 56, stroke: 5 },
    lg: { width: 72, height: 72, stroke: 6 },
  };

  // If score is provided, show a circular meter
  if (score !== undefined) {
    const { width, height, stroke } = meterSizes[size];
    const radius = (width - stroke * 2) / 2;
    const circumference = 2 * Math.PI * radius;
    const dashOffset = circumference - (score / 100) * circumference;

    return (
      <div className="flex flex-col items-center gap-1">
        <div className="relative" style={{ width, height }}>
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="transform -rotate-90"
            width={width}
            height={height}
          >
            {/* Background circle */}
            <circle
              cx={width / 2}
              cy={height / 2}
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth={stroke}
              className="text-gray-100"
            />
            {/* Progress circle */}
            <circle
              cx={width / 2}
              cy={height / 2}
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth={stroke}
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              strokeLinecap="round"
              className={
                level === "low"
                  ? "text-green-500"
                  : level === "medium"
                  ? "text-yellow-500"
                  : level === "high"
                  ? "text-orange-500"
                  : "text-red-500"
              }
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={`font-bold ${size === "sm" ? "text-xs" : size === "md" ? "text-sm" : "text-base"} ${config.textColor}`}>
              {Math.round(score)}
            </span>
          </div>
        </div>
        {showLabel && (
          <span className={`${size === "sm" ? "text-[10px]" : "text-xs"} font-medium ${config.textColor}`}>
            {config.label}
          </span>
        )}
      </div>
    );
  }

  // Badge mode
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full ${config.bgColor} ${config.textColor} ring-1 ${config.ringColor} font-medium ${sizeClasses[size]}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${config.color}`} />
      {showLabel && config.label}
    </span>
  );
}
