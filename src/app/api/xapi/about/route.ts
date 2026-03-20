import { NextResponse } from "next/server";

/**
 * GET /api/xapi/about
 * Returns LRS capabilities and version information per xAPI spec.
 */
export async function GET() {
  return NextResponse.json(
    {
      version: ["1.0.3", "1.0.2", "1.0.1"],
      extensions: {
        name: "LMS Platform xAPI LRS",
        description: "Built-in Learning Record Store for the LMS Platform",
        endpoints: {
          statements: "/api/xapi/statements",
          activities_state: "/api/xapi/activities/state",
          activities_profile: "/api/xapi/activities/profile",
          about: "/api/xapi/about",
        },
      },
    },
    {
      headers: {
        "X-Experience-API-Version": "1.0.3",
      },
    }
  );
}
