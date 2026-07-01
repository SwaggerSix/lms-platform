import { NextRequest, NextResponse } from "next/server";
import { bearerToken, verifyPartnerPortalSecret } from "@/lib/integrations/partner-portal/auth";
import { listGothamCourses } from "@/lib/integrations/partner-portal/courses";

// Read API consumed by the gC Partner Portal course sync. The portal pulls the
// full gC/GGS catalog from here on a schedule and upserts it into its
// `gotham_courses` table (source='lms'), deactivating any lms-sourced row that
// no longer appears. Auth is the shared PARTNER_PORTAL_WEBHOOK_SECRET bearer.
export const dynamic = "force-dynamic";

/**
 * GET /api/integrations/partner-portal/courses
 * → { courses: CanonicalGothamCourse[], generated_at: string }
 *
 * Returns the complete, deduped set of active gC/GGS courses. The portal
 * treats this response as authoritative: anything present is upserted; any
 * lms_course_id it holds that is absent here should be deactivated.
 */
export async function GET(request: NextRequest) {
  const token = bearerToken(request.headers.get("authorization"));
  if (!verifyPartnerPortalSecret(token)) {
    // 503 when the secret isn't configured at all (mirrors the webhook route),
    // otherwise a bad/absent token is a 401.
    if (!process.env.PARTNER_PORTAL_WEBHOOK_SECRET) {
      return NextResponse.json(
        { error: "Course sync secret not configured" },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const courses = await listGothamCourses();
    return NextResponse.json({
      courses,
      generated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Gotham course catalog export failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
