import React from "react";
import { cn } from "@/utils/cn";

export interface MessageBubbleProps {
  /** Sent by the current user → right-aligned with the primary fill. */
  mine: boolean;
  children: React.ReactNode;
  /** Optional avatar element; when present the row gains a gap and the
   * avatar sits on the outer edge (opposite the alignment). */
  avatar?: React.ReactNode;
  /** Optional content rendered inside the bubble above the body (e.g. a
   * sender name · timestamp line). Caller styles it. */
  header?: React.ReactNode;
  /** Optional content rendered below the bubble (e.g. a timestamp or read
   * receipt); it inherits the bubble's left/right alignment. */
  footer?: React.ReactNode;
  /** "assistant" gives the received bubble the white bordered surface used
   * by the AI chat; "default" is the gray fill used elsewhere. */
  tone?: "default" | "assistant";
  /** Max width of the bubble column. */
  maxWidthClass?: string;
  /** Extra classes for the bubble itself (e.g. leading-relaxed). */
  className?: string;
}

/**
 * Shared chat/message bubble (UX review §2.8). One sent/received treatment
 * for the messaging surfaces: right-aligned primary fill when `mine`,
 * left-aligned tinted fill otherwise, with the standard rounded-2xl shape
 * and asymmetric tail corner. Avatar, header, and footer are slots so each
 * surface can supply its own extras (markdown body, sender line, read
 * receipts) without re-implementing the layout.
 */
export function MessageBubble({
  mine,
  children,
  avatar,
  header,
  footer,
  tone = "default",
  maxWidthClass = "max-w-[75%]",
  className,
}: MessageBubbleProps) {
  return (
    <div
      className={cn(
        "flex",
        avatar ? "gap-3" : "",
        avatar ? (mine ? "flex-row-reverse" : "flex-row") : mine ? "justify-end" : "justify-start"
      )}
    >
      {avatar}
      <div className={cn("flex flex-col", maxWidthClass, mine ? "items-end" : "items-start")}>
        <div
          className={cn(
            "rounded-2xl px-4 py-2 text-sm",
            mine
              ? "rounded-br-md bg-primary-600 text-white"
              : tone === "assistant"
                ? "rounded-bl-md border border-gray-200 bg-white text-gray-800 shadow-sm"
                : "rounded-bl-md bg-gray-100 text-gray-900",
            className
          )}
        >
          {header}
          {children}
        </div>
        {footer}
      </div>
    </div>
  );
}
