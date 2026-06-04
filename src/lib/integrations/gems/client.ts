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

export class GemsClient {
  constructor(private readonly config: GemsConfig) {}

  private get base(): string {
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

  /** Verify connectivity + auth by listing events with a narrow filter. */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      await this.searchTrainingEvents({});
      return { success: true, message: "Successfully connected to GEMS" };
    } catch (error) {
      return {
        success: false,
        message: `Connection failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  /** POST /api/TrainingEvent — search/filter the event list. */
  async searchTrainingEvents(
    filter: GemsEventFilter
  ): Promise<GemsTrainingEvent[]> {
    return this.request<GemsTrainingEvent[]>("/api/TrainingEvent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(filter),
    });
  }

  /** GET /api/TrainingEvent/{eventId} — full event detail (eventId is an integer). */
  async getTrainingEvent(eventId: number | string): Promise<GemsTrainingEvent> {
    return this.request<GemsTrainingEvent>(
      `/api/TrainingEvent/${encodeURIComponent(String(eventId))}`
    );
  }

  // ─── Reference / lookup endpoints (all GET, JSON arrays) ───────

  async getInstructors() {
    return this.request<unknown[]>("/api/Instructor");
  }
  async getCustomers() {
    return this.request<unknown[]>("/api/Customer/");
  }
  async getCourseProducts(): Promise<GemsCourseProductCatalog[]> {
    return this.request<GemsCourseProductCatalog[]>("/api/CourseProduct");
  }
  async getCourseLocations() {
    return this.request<unknown[]>("/api/CourseLocation");
  }
  async getDivisions() {
    return this.request<unknown[]>("/api/Division");
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
