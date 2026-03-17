import React from "react";
import { cn } from "@/utils/cn";

const colorClasses = {
  default: "bg-indigo-600",
  success: "bg-green-500",
  warning: "bg-amber-500",
  danger: "bg-red-500",
  info: "bg-blue-500",
} as const;

const sizeClasses = {
  sm: "h-1.5",
  default: "h-2.5",
  lg: "h-4",
} as const;

export interface ProgressBarProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number;
  color?: keyof typeof colorClasses;
  size?: keyof typeof sizeClasses;
  showLabel?: boolean;
}

function ProgressBar({
  value,
  color = "default",
  size = "default",
  showLabel = false,
  className,
  ...props
}: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, value));

  return (
    <div className={cn("w-full", className)} {...props}>
      {showLabel && (
        <div className="mb-1 flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">Progress</span>
          <span className="text-sm font-medium text-gray-700">
            {Math.round(clamped)}%
          </span>
        </div>
      )}
      <div
        className={cn(
          "w-full overflow-hidden rounded-full bg-gray-200",
          sizeClasses[size]
        )}
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={cn(
            "h-full rounded-full transition-all duration-300 ease-in-out",
            colorClasses[color]
          )}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}

export { ProgressBar };
