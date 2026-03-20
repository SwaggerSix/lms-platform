/**
 * LRS Client
 * Manages communication with external Learning Record Store endpoints.
 * Supports Basic and OAuth authentication with retry logic.
 */

import type { XAPIStatement } from "./statement-builder";

export interface LRSConfig {
  id: string;
  endpoint_url: string;
  auth_type: "basic" | "oauth";
  username?: string | null;
  password_encrypted?: string | null;
  token_encrypted?: string | null;
}

interface LRSQueryParams {
  agent?: string;
  verb?: string;
  activity?: string;
  registration?: string;
  since?: string;
  until?: string;
  limit?: number;
  ascending?: boolean;
  related_activities?: boolean;
  related_agents?: boolean;
}

interface StatementResult {
  statements: XAPIStatement[];
  more?: string;
}

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

export class LRSClient {
  private config: LRSConfig;
  private baseUrl: string;

  constructor(config: LRSConfig) {
    this.config = config;
    this.baseUrl = config.endpoint_url.replace(/\/$/, "");
  }

  // ─── Auth Headers ────────────────────────────────────────────────────────

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Experience-API-Version": "1.0.3",
    };

    if (this.config.auth_type === "basic" && this.config.username && this.config.password_encrypted) {
      const credentials = Buffer.from(
        `${this.config.username}:${this.config.password_encrypted}`
      ).toString("base64");
      headers["Authorization"] = `Basic ${credentials}`;
    } else if (this.config.auth_type === "oauth" && this.config.token_encrypted) {
      headers["Authorization"] = `Bearer ${this.config.token_encrypted}`;
    }

    return headers;
  }

  // ─── Retry Logic ─────────────────────────────────────────────────────────

  private async fetchWithRetry(
    url: string,
    options: RequestInit,
    retries = MAX_RETRIES
  ): Promise<Response> {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await fetch(url, options);

        // Don't retry client errors (4xx), only server errors (5xx)
        if (response.ok || (response.status >= 400 && response.status < 500)) {
          return response;
        }

        if (attempt < retries) {
          await new Promise((resolve) =>
            setTimeout(resolve, RETRY_DELAY_MS * Math.pow(2, attempt))
          );
          continue;
        }

        return response;
      } catch (error) {
        if (attempt === retries) {
          throw error;
        }
        await new Promise((resolve) =>
          setTimeout(resolve, RETRY_DELAY_MS * Math.pow(2, attempt))
        );
      }
    }

    throw new Error("Max retries exceeded");
  }

  // ─── Statements ──────────────────────────────────────────────────────────

  /**
   * Push a single xAPI statement to the LRS.
   */
  async pushStatement(statement: XAPIStatement): Promise<string[]> {
    const url = `${this.baseUrl}/statements`;
    const response = await this.fetchWithRetry(url, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(statement),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      throw new Error(`Failed to push statement: ${response.status} - ${errorText}`);
    }

    return response.json();
  }

  /**
   * Push multiple xAPI statements to the LRS.
   */
  async pushStatements(statements: XAPIStatement[]): Promise<string[]> {
    const url = `${this.baseUrl}/statements`;
    const response = await this.fetchWithRetry(url, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(statements),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      throw new Error(`Failed to push statements: ${response.status} - ${errorText}`);
    }

    return response.json();
  }

  /**
   * Query xAPI statements from the LRS.
   */
  async queryStatements(params?: LRSQueryParams): Promise<StatementResult> {
    const url = new URL(`${this.baseUrl}/statements`);

    if (params) {
      if (params.agent) url.searchParams.set("agent", params.agent);
      if (params.verb) url.searchParams.set("verb", params.verb);
      if (params.activity) url.searchParams.set("activity", params.activity);
      if (params.registration) url.searchParams.set("registration", params.registration);
      if (params.since) url.searchParams.set("since", params.since);
      if (params.until) url.searchParams.set("until", params.until);
      if (params.limit !== undefined) url.searchParams.set("limit", String(params.limit));
      if (params.ascending !== undefined) url.searchParams.set("ascending", String(params.ascending));
      if (params.related_activities !== undefined)
        url.searchParams.set("related_activities", String(params.related_activities));
      if (params.related_agents !== undefined)
        url.searchParams.set("related_agents", String(params.related_agents));
    }

    const response = await this.fetchWithRetry(url.toString(), {
      method: "GET",
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      throw new Error(`Failed to query statements: ${response.status} - ${errorText}`);
    }

    return response.json();
  }

  // ─── Activity State ──────────────────────────────────────────────────────

  /**
   * Retrieve activity state document.
   */
  async getActivityState(
    activityId: string,
    agent: string,
    stateId: string,
    registration?: string
  ): Promise<unknown> {
    const url = new URL(`${this.baseUrl}/activities/state`);
    url.searchParams.set("activityId", activityId);
    url.searchParams.set("agent", agent);
    url.searchParams.set("stateId", stateId);
    if (registration) url.searchParams.set("registration", registration);

    const response = await this.fetchWithRetry(url.toString(), {
      method: "GET",
      headers: this.getHeaders(),
    });

    if (response.status === 404) return null;

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      throw new Error(`Failed to get activity state: ${response.status} - ${errorText}`);
    }

    return response.json();
  }

  /**
   * Store activity state document.
   */
  async setActivityState(
    activityId: string,
    agent: string,
    stateId: string,
    document: unknown,
    registration?: string
  ): Promise<void> {
    const url = new URL(`${this.baseUrl}/activities/state`);
    url.searchParams.set("activityId", activityId);
    url.searchParams.set("agent", agent);
    url.searchParams.set("stateId", stateId);
    if (registration) url.searchParams.set("registration", registration);

    const response = await this.fetchWithRetry(url.toString(), {
      method: "PUT",
      headers: this.getHeaders(),
      body: JSON.stringify(document),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      throw new Error(`Failed to set activity state: ${response.status} - ${errorText}`);
    }
  }

  // ─── Activity Profile ────────────────────────────────────────────────────

  /**
   * Retrieve activity profile document.
   */
  async getActivityProfile(
    activityId: string,
    profileId: string
  ): Promise<unknown> {
    const url = new URL(`${this.baseUrl}/activities/profile`);
    url.searchParams.set("activityId", activityId);
    url.searchParams.set("profileId", profileId);

    const response = await this.fetchWithRetry(url.toString(), {
      method: "GET",
      headers: this.getHeaders(),
    });

    if (response.status === 404) return null;

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      throw new Error(`Failed to get activity profile: ${response.status} - ${errorText}`);
    }

    return response.json();
  }

  /**
   * Store activity profile document.
   */
  async setActivityProfile(
    activityId: string,
    profileId: string,
    document: unknown
  ): Promise<void> {
    const url = new URL(`${this.baseUrl}/activities/profile`);
    url.searchParams.set("activityId", activityId);
    url.searchParams.set("profileId", profileId);

    const response = await this.fetchWithRetry(url.toString(), {
      method: "PUT",
      headers: this.getHeaders(),
      body: JSON.stringify(document),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      throw new Error(`Failed to set activity profile: ${response.status} - ${errorText}`);
    }
  }

  // ─── Connection Test ─────────────────────────────────────────────────────

  /**
   * Test connection to the LRS by calling the /about endpoint.
   */
  async testConnection(): Promise<{ success: boolean; message: string; data?: unknown }> {
    try {
      const url = `${this.baseUrl}/about`;
      const response = await fetch(url, {
        method: "GET",
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        return {
          success: false,
          message: `Connection failed with status ${response.status}`,
        };
      }

      const data = await response.json().catch(() => null);
      return {
        success: true,
        message: "Connection successful",
        data,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Connection failed",
      };
    }
  }
}
