import React from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/utils/cn";

export interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  value: string | number;
  change?: {
    value: number;
    direction: "up" | "down";
  };
  icon?: React.ReactNode;
}

function StatCard({ title, value, change, icon, className, ...props }: StatCardProps) {
  const isPositive = change?.direction === "up";

  return (
    <div
      className={cn(
        "rounded-lg border border-gray-200 bg-white p-6 shadow-sm",
        className
      )}
      {...props}
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-500">{title}</p>
        {icon && <div className="text-gray-400">{icon}</div>}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        {change && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 text-sm font-medium",
              isPositive ? "text-green-600" : "text-red-600"
            )}
          >
            {isPositive ? (
              <TrendingUp className="h-3.5 w-3.5" />
            ) : (
              <TrendingDown className="h-3.5 w-3.5" />
            )}
            {Math.abs(change.value)}%
          </span>
        )}
      </div>
    </div>
  );
}

export { StatCard };
