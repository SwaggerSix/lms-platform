"use client";

import React from "react";
import { cn } from "@/utils/cn";

export interface SegmentedControlOption {
  value: string;
  label: React.ReactNode;
}

/**
 * Segmented control — the app's second sanctioned tab pattern (UX review
 * §3.4), for compact in-place switches: a gray track with a white active
 * segment. Use the underline Tabs primitive for page-level content tabs;
 * use this for source/filter switches that sit inline with other controls.
 */
export function SegmentedControl({
  value,
  onChange,
  options,
  className,
  "aria-label": ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  options: SegmentedControlOption[];
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(
        "flex w-fit items-center gap-1 rounded-lg bg-gray-100 p-1",
        className
      )}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          className={cn(
            "whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium transition-colors",
            value === option.value
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
