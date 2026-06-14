/**
 * Report a client-side error to the error_logs table via the API. Safe to call
 * from React error boundaries — failures are swallowed so reporting can never
 * cascade into another error.
 */
export function reportClientError(
  error: Error & { digest?: string },
  context?: Record<string, unknown>
): void {
  try {
    const payload = JSON.stringify({
      message: error?.message || "Unknown client error",
      stack: error?.stack,
      digest: error?.digest,
      path: typeof window !== "undefined" ? window.location.pathname : undefined,
      severity: "error",
      context,
    });

    // Prefer sendBeacon so the report survives navigation/unmount; fall back to fetch.
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      const blob = new Blob([payload], { type: "application/json" });
      const ok = navigator.sendBeacon("/api/error-logs", blob);
      if (ok) return;
    }

    void fetch("/api/error-logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Never throw from the reporter.
  }
}
