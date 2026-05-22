"use client";

import { useEffect, useState } from "react";

interface RelativeTimeProps {
  iso: string;
  /** Refresh cadence in ms. Default 30s — fine for "Nm ago" scale text. */
  intervalMs?: number;
  /** Optional title override; defaults to iso.toLocaleString(). */
  title?: string;
  className?: string;
  /** Prefix rendered before the relative-time text (e.g. "last "). */
  prefix?: string;
  /** Suffix rendered after. */
  suffix?: string;
}

function relative(iso: string): string {
  if (!iso || iso === "never") return "never";
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return iso;
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/**
 * Renders a relative-time label that auto-refreshes on its own
 * interval. Used to scope re-renders to the timestamp element rather
 * than the whole page that contains it. Each instance owns its own
 * interval, which adds up — keep the count reasonable (dozens, not
 * thousands).
 */
export function RelativeTime({
  iso,
  intervalMs = 30_000,
  title,
  className,
  prefix,
  suffix,
}: RelativeTimeProps) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!iso || iso === "never") return;
    const id = setInterval(() => setTick((t) => t + 1), intervalMs);
    return () => clearInterval(id);
  }, [iso, intervalMs]);
  const resolvedTitle = title ?? (iso && iso !== "never" ? new Date(iso).toLocaleString() : undefined);
  return (
    <span title={resolvedTitle} className={className}>
      {prefix}
      {relative(iso)}
      {suffix}
    </span>
  );
}
