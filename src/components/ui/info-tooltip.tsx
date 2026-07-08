"use client";

import React, { useId, useRef, useState } from "react";
import { Info } from "lucide-react";
import { cn } from "@/utils/cn";

export interface InfoTooltipProps {
  content: React.ReactNode;
  label?: string;
  side?: "top" | "bottom" | "left" | "right";
  className?: string;
  iconClassName?: string;
}

export function InfoTooltip({
  content,
  label = "More information",
  side = "top",
  className,
  iconClassName,
}: InfoTooltipProps) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const closeTimer = useRef<number | null>(null);

  const show = () => {
    if (closeTimer.current) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    setOpen(true);
  };

  const scheduleHide = () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setOpen(false), 120);
  };

  const positionClass =
    side === "top"
      ? "bottom-full left-1/2 mb-2 -translate-x-1/2"
      : side === "bottom"
      ? "top-full left-1/2 mt-2 -translate-x-1/2"
      : side === "left"
      ? "right-full top-1/2 mr-2 -translate-y-1/2"
      : "left-full top-1/2 ml-2 -translate-y-1/2";

  return (
    <span
      className={cn("relative inline-flex", className)}
      onMouseEnter={show}
      onMouseLeave={scheduleHide}
      onFocus={show}
      onBlur={scheduleHide}
    >
      <button
        type="button"
        aria-label={label}
        aria-describedby={open ? id : undefined}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex h-4 w-4 items-center justify-center rounded-full text-gray-400 hover:text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500",
          iconClassName
        )}
      >
        <Info className="h-4 w-4" aria-hidden="true" />
      </button>
      {open && (
        <span
          id={id}
          role="tooltip"
          className={cn(
            "absolute z-50 w-64 rounded-md border border-gray-200 bg-white p-3 text-xs leading-relaxed text-gray-700 shadow-lg",
            positionClass
          )}
        >
          {content}
        </span>
      )}
    </span>
  );
}

export default InfoTooltip;
