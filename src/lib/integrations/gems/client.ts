import { getAccessToken } from "./auth";
import type {
  GemsConfig,
  GemsEventFilter,
  GemsTrainingEvent,
} from "./types";

// ─────────────────────────────────────────────────────────────────
// GEMS REST client — typed, read-only access to /api/*.
//
// All calls attach an Azure AD bearer token. The client only issues
// GET (lookups, event detail) and the POST /api/TrainingEvent search
// (which is a read despite the verb); it never mutates GEMS data.
// ─────────────────────────────────────────────────────────────────

const DOTNET_DATE_MIN = "0001-01-01";

/**
 * Parse a .NET ISO date string, treating DateTime.MinValue
 * ("0001-01-01T00:00:00") as null ("not set").
 */
export function parseGemsDate(value: unknown): Date | null {
  if (typeof value !== "string" || value.length === 0) return null;
  if (value.startsWith(DOTNET_DATE_MIN)) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

/** Date portion (YYYY-MM-DD) of a GEMS date, or null if unset. */
export function gemsDatePart(value: unknown): string | null {
  const d = parseGemsDate(value);
  return d ? d.toISOString().slice(0, 10) : null;
}

/** Time portion (HH:MM:SS) of a GEMS time, or null if unset. */
export function gemsTimePart(value: unknown): string | null {
  const d = parseGemsDate(value);
  return d ? d.toISOString().slice(11, 19) : null;
}

/**
 * GEMS endpoints return collections in a variety of envelopes:
 *   - bare JSON array
 *   - `{ "$id": "...", "$values": [...] }`  (ReferenceHandler.Preserve)
 *   - `{ "queryResults": { "$values": [...] }, "totalCount": N, ... }`
 *     (the POST /api/TrainingEvent search shape)
 *   - other common envelope keys (data/value/items/results)
 *
 * This helper unwraps any of those — and crucially, descends one level
 * deeper if it finds e.g. `queryResults` that is itself a `$values` wrapper.
 */
function asArray<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (!data || typeof data !== "object") return [];
  const obj = data as Record<string, unknown>;
  // Direct array under a known key.
  for (const key of [
    "$values",
    "queryResults",
    "data",
    "value",
    "items",
    "results",
    "Items",
    "Data",
    "Value",
    "Results",
  ]) {
    const v = obj[key];
    if (Array.isArray(v)) return v as T[];
    // Nested .NET wrapper: queryResults -> { $values: [...] }
    if (v && typeof v === "object") {
      const inner = (v as Record<string, unknown>).$values;
      if (Array.isArray(inner)) return inner as T[];
    }
  }
  return [];
}

/**
 * Best-effort decode of a JWT's payload (no signature validation; for
 * diagnostics only). Returns null if the string isn't a parseable JWT.
 */
export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
    const json = Buffer.from(b64 + pad, "base64").toString("utf8");
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Pluck the claims most relevant for diagnosing a GEMS 403: did we send
 * the right audience? scope? user identity? group membership?
 */
function summarizeClaims(claims: Record<string, unknown> | null): string {
  if (!claims) return "(unable to decode token)";
  const pick = (k: string) => {
    const v = claims[k];
    if (v === undefined) return null;
    if (Array.isArray(v)) {
      const arr = v as unknown[];
      return arr.length > 6 ? `[${arr.length} entries]` : JSON.stringify(arr);
    }
    return typeof v === "string" || typeof v === "number" || typeof v === "boolean"
      ? String(v)
      : JSON.stringify(v);
  };
  const fields = ["aud", "iss", "scp", "roles", "upn", "preferred_username", "oid", "appid", "groups"];
  return fields
    .map((f) => `${f}=${pick(f) ?? "—"}`)
    .filter((s) => !s.endsWith("=—"))
    .join(", ");
}

export class GemsClient {
  constructor(private readonly config: GemsConfig) {}

  private get base(): string {
    if (!this.config.api_base) {
      throw new Error("GEMS API URL is required");
    }
    return this.config.api_base.replace(/\/+$/, "");
  }

  private async authHeaders(): Promise<Record<string, string>> {
    const token = await getAccessToken(this.config);
    return {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    };
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${this.base}${path}`, {
      ...init,
      headers: { ...(await this.authHeaders()), ...(init?.headers ?? {}) },
    });
    if (!response.ok) {
      throw new Error(
        `GEMS API ${init?.method ?? "GET"} ${path} failed: ${response.status} ${response.statusText}`
      );
    }
    return response.json() as Promise<T>;
  }

  /**
   * Verify connectivity + auth. On 4xx responses, include a one-line
   * summary of the token's claims so an admin can see whether the right
   * `aud`, `scp`, `upn` etc. are being sent. Diagnostics only — the
   * token itself is never logged or returned.
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      await this.searchTrainingEvents({});
      return { success: true, message: "Successfully connected to GEMS" };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      let diag = "";
      try {
        const token = await getAccessToken(this.config);
        diag = ` | Token claims: ${summarizeClaims(decodeJwtPayload(token))}`;
      } catch {
        diag = " | (token unavailable for diagnostics)";
      }
      return { success: false, message: `Connection failed: ${message}${diag}` };
    }
  }

  /** POST /api/TrainingEvent — search/filter the event list. */
  async searchTrainingEvents(
    filter: GemsEventFilter
  ): Promise<GemsTrainingEvent[]> {
    const raw = await this.request<unknown>("/api/TrainingEvent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(filter),
    });
    return asArray<GemsTrainingEvent>(raw);
  }

  /** GET /api/TrainingEvent/{eventId} — full event detail (eventId is an integer). */
  async getTrainingEvent(eventId: number | string): Promise<GemsTrainingEvent> {
    return this.request<GemsTrainingEvent>(
      `/api/TrainingEvent/${encodeURIComponent(String(eventId))}`
    );
  }

  // ─── Reference / lookup endpoints (all GET, JSON arrays) ───────

  async getInstructors() {
    return asArray<unknown>(await this.request<unknown>("/api/Instructor"));
  }
  async getCustomers() {
    return asArray<unknown>(await this.request<unknown>("/api/Customer/"));
  }
  async getCourseProducts(): Promise<GemsCourseProductCatalog[]> {
    return asArray<GemsCourseProductCatalog>(
      await this.request<unknown>("/api/CourseProduct")
    );
  }
  async getCourseLocations() {
    return asArray<unknown>(await this.request<unknown>("/api/CourseLocation"));
  }
  async getDivisions() {
    return asArray<unknown>(await this.request<unknown>("/api/Division"));
  }
}

/**
 * GEMS course-catalog row as returned by GET /api/CourseProduct. Field
 * names mirror the TrainingEvent.courseProduct nested object.
 */
export interface GemsCourseProductCatalog {
  courseProductId: number;
  productDescription: string;
  productCode: string;
  min?: number;
  max?: number;
  sinnumber?: string;
}
