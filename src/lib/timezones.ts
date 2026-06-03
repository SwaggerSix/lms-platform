/** Curated list of timezones offered in registration/profile pickers. */
export const COMMON_TIMEZONES: { value: string; label: string }[] = [
  { value: "Pacific/Honolulu", label: "Hawaii (HST)" },
  { value: "America/Anchorage", label: "Alaska (AKT)" },
  { value: "America/Los_Angeles", label: "Pacific (PT)" },
  { value: "America/Denver", label: "Mountain (MT)" },
  { value: "America/Chicago", label: "Central (CT)" },
  { value: "America/New_York", label: "Eastern (ET)" },
  { value: "America/Halifax", label: "Atlantic (AT)" },
  { value: "America/Sao_Paulo", label: "São Paulo (BRT)" },
  { value: "Europe/London", label: "London (GMT/BST)" },
  { value: "Europe/Berlin", label: "Central Europe (CET)" },
  { value: "Europe/Athens", label: "Eastern Europe (EET)" },
  { value: "Africa/Johannesburg", label: "Johannesburg (SAST)" },
  { value: "Asia/Dubai", label: "Dubai (GST)" },
  { value: "Asia/Kolkata", label: "India (IST)" },
  { value: "Asia/Singapore", label: "Singapore (SGT)" },
  { value: "Asia/Tokyo", label: "Tokyo (JST)" },
  { value: "Australia/Sydney", label: "Sydney (AET)" },
  { value: "Pacific/Auckland", label: "Auckland (NZT)" },
];

const DEFAULT_TIMEZONE = "America/New_York";

/** The browser's detected IANA timezone, falling back to a sensible default. */
export function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_TIMEZONE;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

/** Validate a string is a usable IANA timezone identifier. */
export function isValidTimezone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
