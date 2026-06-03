export function formatDuration(minutes: number | null): string {
  if (!minutes) return "—";
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function formatDate(date: string | null, timeZone?: string): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    ...(timeZone ? { timeZone } : {}),
  });
}

export function formatDateTime(date: string | null, timeZone?: string): string {
  if (!date) return "—";
  return new Date(date).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    ...(timeZone ? { timeZone } : {}),
  });
}

/**
 * Interpret a wall-clock date (YYYY-MM-DD) + time (HH:MM[:SS]) as being in
 * `sourceTz` and return the corresponding UTC instant. Used for records that
 * store local wall-clock time plus a named timezone (e.g. ILT sessions).
 */
export function zonedWallClockToInstant(
  dateStr: string,
  timeStr: string,
  sourceTz: string
): Date {
  const time = timeStr && timeStr.length >= 5 ? timeStr : "00:00:00";
  const naiveUtc = new Date(`${dateStr}T${time}Z`);
  if (isNaN(naiveUtc.getTime())) return new Date(`${dateStr}T${time}`);
  // How that same UTC instant reads as wall-clock in the source tz vs UTC.
  const asSource = new Date(naiveUtc.toLocaleString("en-US", { timeZone: sourceTz }));
  const asUtc = new Date(naiveUtc.toLocaleString("en-US", { timeZone: "UTC" }));
  const offset = asUtc.getTime() - asSource.getTime();
  return new Date(naiveUtc.getTime() + offset);
}

/**
 * Format an ILT-style wall-clock time (in `sourceTz`) as a clock time in the
 * viewer's `viewerTz`, e.g. "2:00 PM".
 */
export function formatZonedTime(
  dateStr: string,
  timeStr: string,
  sourceTz: string,
  viewerTz: string
): string {
  const instant = zonedWallClockToInstant(dateStr, timeStr, sourceTz);
  return instant.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: viewerTz,
  });
}

/** Short timezone abbreviation for a tz on a given date, e.g. "PST", "EDT". */
export function timezoneAbbrev(timeZone: string, date: Date = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      timeZoneName: "short",
    }).formatToParts(date);
    return parts.find((p) => p.type === "timeZoneName")?.value ?? timeZone;
  } catch {
    return timeZone;
  }
}

export function formatPercent(value: number | null): string {
  if (value === null || value === undefined) return "0%";
  return `${Math.round(value)}%`;
}

export function formatScore(score: number | null): string {
  if (score === null || score === undefined) return "—";
  return `${Math.round(score)}%`;
}

export function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function truncate(text: string, length: number): string {
  if (text.length <= length) return text;
  return text.slice(0, length) + "...";
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

export function formatRelativeTime(date: string | Date): string {
  const now = new Date();
  const d = new Date(date);
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(date as string);
}
