// <input type="datetime-local"> holds a wall-clock time with no zone
// ("2026-11-09T14:30"). The database holds instants (ISO strings). These two
// convert between them in the browser's own time zone, so a date saved and
// then opened again for editing shows the same time the admin typed.

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** ISO instant → "YYYY-MM-DDTHH:mm" in local time ("" for none or invalid). */
export function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** "YYYY-MM-DDTHH:mm" read as local time → ISO instant (null for empty). */
export function localInputToIso(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
