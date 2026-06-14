import type { Instrumentation } from "next";

/**
 * Next.js global server-side error hook. Fires for every uncaught error in
 * Route Handlers, Server Components, server actions, and middleware, giving us
 * automatic capture of server-side failures without touching every route.
 *
 * Only runs in the Node.js runtime — the error_logs writer relies on the
 * Supabase service client, which is not available on the edge.
 */
export const onRequestError: Instrumentation.onRequestError = async (
  err,
  request,
  context
) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  try {
    const { logError } = await import("@/lib/error-log");
    const userAgent = request.headers["user-agent"];
    await logError({
      error: err,
      source: "server",
      severity: "error",
      path: request.path,
      method: request.method,
      digest: (err as { digest?: string })?.digest,
      userAgent: Array.isArray(userAgent) ? userAgent[0] : userAgent,
      context: {
        routerKind: context.routerKind,
        routePath: context.routePath,
        routeType: context.routeType,
        renderSource: context.renderSource,
        revalidateReason: context.revalidateReason,
      },
    });
  } catch (loggingError) {
    // Never let error logging break the runtime.
    console.error("onRequestError logging failed:", loggingError);
  }
};
