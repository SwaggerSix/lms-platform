import React from "react";
import { cn } from "@/utils/cn";
import { InfoTooltip } from "./info-tooltip";

export interface PageIntroProps {
  title: string;
  description?: React.ReactNode;
  details?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export function PageIntro({
  title,
  description,
  details,
  actions,
  className,
}: PageIntroProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between",
        className
      )}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          {details && (
            <InfoTooltip content={details} label={`About ${title}`} side="bottom" />
          )}
        </div>
        {description && (
          <p className="mt-1 text-sm text-gray-500">{description}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

export default PageIntro;
