import { NextResponse } from "next/server";
import { jsonNoStore } from "@/lib/api/no-store";

/**
 * Every method on /api/compliance is permanently retired. Required
 * training is configured via courses.metadata.required_for from
 * /admin/courses → Required Training; reads should go through
 * GET /api/courses (or the server-side helper getRequiredCourseSources).
 *
 * All methods return 410 Gone with the same RFC 8594 Sunset + Link
 * headers so any lingering integration gets a single, machine-readable
 * deprecation signal. Kept as one shared handler since the response
 * is identical regardless of method.
 */
function gone(): NextResponse {
  return jsonNoStore(
    {
      error:
        "Endpoint retired. Required training is configured under /admin/courses (Required Training section); read via GET /api/courses.",
      successor: "/admin/courses",
    },
    {
      status: 410,
      headers: {
        Deprecation: "true",
        Sunset: "Wed, 01 Jan 2026 00:00:00 GMT",
        Link: '</admin/courses>; rel="successor-version"',
      },
    }
  );
}

export async function GET() {
  return gone();
}

export async function POST() {
  return gone();
}

export async function PATCH() {
  return gone();
}

export async function DELETE() {
  return gone();
}
