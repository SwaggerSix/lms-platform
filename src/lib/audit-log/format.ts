/**
 * Display helpers for the audit-log page. Lives in lib/ so the
 * normalization of stored `action` strings and ISO timestamps into
 * the row labels the table renders is unit-testable in isolation.
 */

export type DisplayAction = "Created" | "Updated" | "Deleted" | "Login" | "Export" | "System";

const VALID_DISPLAY_ACTIONS: readonly DisplayAction[] = [
  "Created",
  "Updated",
  "Deleted",
  "Login",
  "Export",
  "System",
] as const;

/**
 * Map a stored audit action string into the small display set used by
 * the legacy table chips. Strings that don't correspond to a known
 * legacy verb (e.g. dotted namespaces like "replay.cron_alerts") fall
 * through to "System" so the badge column always renders something.
 *
 * Only the first dotted segment is considered when matching — that's
 * what the table column shows, since the full action lives in the
 * description cell.
 */
export function formatAction(action: string): DisplayAction {
  if (!action) return "System";
  const head = action.split(".")[0];
  const normalized = head.charAt(0).toUpperCase() + head.slice(1).toLowerCase();
  return (VALID_DISPLAY_ACTIONS as readonly string[]).includes(normalized)
    ? (normalized as DisplayAction)
    : "System";
}

/**
 * Format an ISO 8601 timestamp into a fixed-width "YYYY-MM-DD HH:MM:SS"
 * string in the caller's local timezone. The output is what the audit
 * log table renders for the timestamp column.
 *
 * Returns "—" for an unparseable input so the cell never breaks layout.
 */
export function formatTimestamp(ts: string): string {
  if (!ts) return "—";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "—";
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
