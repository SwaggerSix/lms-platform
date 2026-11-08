import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  SCORM_BUCKET,
  contentTypeFor,
  isHtml,
  shouldProxy,
  storageKeyFromSegments,
} from "@/lib/scorm/package";

/**
 * GET /scorm-content/<packageId>/<path...>
 *
 * Serves extracted SCORM package files from the private course-content bucket
 * on the app's own origin. Same-origin matters: SCORM content finds the LMS
 * runtime by walking window.parent looking for window.API / API_1484_11, and
 * browsers block that walk across origins — so a package served straight from
 * *.supabase.co can display but can never report completion.
 *
 * Text assets (HTML, CSS, JS, JSON, XML) are streamed through this route.
 * Media and other binaries get a short-lived signed-URL redirect so large
 * videos don't run through a serverless function (and keep Range support).
 *
 * This path is excluded from middleware (see src/middleware.ts) so a course
 * launch with hundreds of files doesn't run the full auth/feature-gate stack
 * per file; the session is checked here instead.
 */

// Serving a text file larger than this through the function risks Vercel's
// response size limit; fall back to a redirect.
const MAX_PROXY_BYTES = 4 * 1024 * 1024;
const SIGNED_URL_TTL = 60 * 60; // 1 hour

function baseHeaders(contentType: string, html: boolean): Record<string, string> {
  const h: Record<string, string> = {
    "Content-Type": contentType,
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "private, max-age=300",
    "Referrer-Policy": "strict-origin-when-cross-origin",
  };
  if (html) {
    // The package must be frameable by the course player (same origin), but
    // nobody else. Script policy is left to the package: authoring-tool
    // output relies on inline scripts and eval.
    h["X-Frame-Options"] = "SAMEORIGIN";
    h["Content-Security-Policy"] = "frame-ancestors 'self'";
  }
  return h;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const segments = (path ?? []).map((s) => {
    try {
      return decodeURIComponent(s);
    } catch {
      return s;
    }
  });
  const key = storageKeyFromSegments(segments);
  if (!key) return new NextResponse("Not found", { status: 404 });

  // Any signed-in user may load package files; enrollment is enforced by the
  // course player that hands out the launch URL. getClaims verifies the JWT
  // locally when the project uses asymmetric signing keys, so this stays
  // cheap across the many requests a single launch makes.
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) {
    return new NextResponse("Sign in to view this content.", { status: 401 });
  }

  const service = createServiceClient();
  const storage = service.storage.from(SCORM_BUCKET);
  const html = isHtml(key);

  if (shouldProxy(key)) {
    const { data: blob, error } = await storage.download(key);
    if (error || !blob) return new NextResponse("Not found", { status: 404 });
    if (blob.size <= MAX_PROXY_BYTES || html) {
      return new NextResponse(blob.stream(), {
        status: 200,
        headers: { ...baseHeaders(contentTypeFor(key), html), "Content-Length": String(blob.size) },
      });
    }
    // Oversized JS/JSON: fall through to a redirect.
  }

  const { data: signed, error: signErr } = await storage.createSignedUrl(key, SIGNED_URL_TTL);
  if (signErr || !signed?.signedUrl) return new NextResponse("Not found", { status: 404 });

  return new NextResponse(null, {
    status: 302,
    headers: {
      Location: signed.signedUrl,
      // Let the browser reuse the redirect for most of the URL's lifetime.
      "Cache-Control": `private, max-age=${SIGNED_URL_TTL - 300}`,
    },
  });
}
