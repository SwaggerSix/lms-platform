import { cn } from "@/utils/cn";

export interface ResultLimitNoticeProps {
  /** Number of rows actually loaded (the cap). */
  shown: number;
  /** Total rows matching in the database. */
  total: number;
  /** What the rows are, for the message (e.g. "users", "articles"). */
  noun?: string;
  className?: string;
}

/**
 * Shown when a list query was capped for performance and more rows exist
 * than were loaded (UX review §1.5). Makes the truncation visible instead
 * of silently hiding rows past the cap, and nudges toward filtering.
 * Renders nothing when everything fit under the cap.
 */
export function ResultLimitNotice({
  shown,
  total,
  noun = "results",
  className,
}: ResultLimitNoticeProps) {
  if (!total || total <= shown) return null;
  return (
    <p
      className={cn(
        "rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800",
        className
      )}
      role="status"
    >
      Showing the first {shown.toLocaleString()} of {total.toLocaleString()} {noun}. Use
      the filters or search to narrow the list.
    </p>
  );
}
