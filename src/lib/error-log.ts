import { createServiceClient } from "@/lib/supabase/service";

export type ErrorSource = "api" | "server" | "client" | "cron";
export type ErrorSeverity = "error" | "warning" | "fatal";

export interface LogErrorParams {
  /** Error object or message string. */
  error: unknown;
  /** Where the error originated. Defaults to "server". */
  source?: ErrorSource;
  /** Severity level. Defaults to "error". */
  severity?: ErrorSeverity;
  /** Request path, if applicable. */
  path?: string;
  /** HTTP method, if applicable. */
  method?: string;
  /** HTTP status code, if applicable. */
  statusCode?: number;
  /** Next.js error digest, if available. */
  digest?: string;
  /** Arbitrary structured context (ids, params, etc.). */
  context?: Record<string, unknown>;
  /** User who experienced the error, if known. */
  userId?: string;
  /** User agent string, if available. */
  userAgent?: string;
}

function normalizeError(error: unknown): { message: string; stack?: string } {
  if (error instanceof Error) {
    return { message: error.message || error.name || "Unknown error", stack: error.stack };
  }
  if (typeof error === "string") {
    return { message: error };
  }
  try {
    return { message: JSON.stringify(error) };
  } catch {
    return { message: String(error) };
  }
}

/**
 * Persist an error to the error_logs table for admin triage. Fire-and-forget:
 * any failure here is swallowed (logged to the console) so error logging can
 * never itself break the request that produced the original error.
 */
export async function logError(params: LogErrorParams): Promise<void> {
  try {
    const { message, stack } = normalizeError(params.error);
    const service = createServiceClient();
    const { error } = await service.from("error_logs").insert({
      source: params.source ?? "server",
      severity: params.severity ?? "error",
      message: message.slice(0, 8000),
      stack: stack ?? null,
      path: params.path ?? null,
      method: params.method ?? null,
      status_code: params.statusCode ?? null,
      digest: params.digest ?? null,
      context: params.context ?? null,
      user_id: params.userId ?? null,
      user_agent: params.userAgent ?? null,
    });
    if (error) console.error("Error log insert failed:", error.message);
  } catch (err) {
    console.error("Error log network error:", err);
  }
}
