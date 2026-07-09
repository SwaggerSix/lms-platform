"use client";

import React from "react";
import { cn } from "@/utils/cn";

export interface ConversationListItemProps {
  /** Leading element — an avatar or a context icon. */
  leading?: React.ReactNode;
  /** The text block (title row, preview/subtitle row). Wrapped in a
   * min-w-0 flex-1 column so long text truncates instead of overflowing. */
  children: React.ReactNode;
  /** Optional trailing element (e.g. a hover-reveal delete button). It is a
   * sibling of the text block, so absolutely-positioned actions anchor to
   * the row. */
  trailing?: React.ReactNode;
  /** Highlights the row as the selected conversation. */
  active?: boolean;
  /** Adds the right-edge accent border used by the AI-chat session list. */
  activeAccent?: boolean;
  onClick?: () => void;
  className?: string;
}

/**
 * Shared clickable row for conversation/session lists (UX review §2.8): a
 * leading avatar/icon, a truncating text block, and an optional trailing
 * action, with the standard hover and active-selection treatment. Rendered
 * as a keyboard-operable button so surfaces that need a nested action (a
 * delete button) aren't stuck with an invalid button-in-button. The larger
 * bordered content cards (e.g. mentorship requests) are a different shape
 * and intentionally not forced through this.
 */
export function ConversationListItem({
  leading,
  children,
  trailing,
  active,
  activeAccent,
  onClick,
  className,
}: ConversationListItemProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick?.();
        }
      }}
      className={cn(
        "relative flex w-full cursor-pointer items-start gap-3 px-4 py-3 text-left transition-colors",
        active
          ? cn("bg-primary-50", activeAccent && "border-r-2 border-primary-600")
          : "hover:bg-gray-50",
        className
      )}
    >
      {leading}
      <div className="min-w-0 flex-1">{children}</div>
      {trailing}
    </div>
  );
}
