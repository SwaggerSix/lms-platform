import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/auth/authorize";
import { testCalendarConnection } from "@/lib/integrations/teams/calendar";

/**
 * POST /api/teams/calendar-test
 * Test the Azure AD calendar connection.
 */
export async function POST(request: NextRequest) {
  const auth = await authorize("admin");
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const result = await testCalendarConnection();

  if (result.success) {
    return NextResponse.json({
      success: true,
      message: "Successfully authenticated with Azure AD. Calendar sync is ready.",
    });
  }

  return NextResponse.json(
    {
      success: false,
      error: result.error || "Failed to connect to Azure AD",
    },
    { status: 502 }
  );
}
