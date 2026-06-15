import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * GET /api/classes/invite/[token]
 * Public lookup for the accept landing page. The token itself is the secret,
 * so no auth is required — we return only what's needed to render the page.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const service = createServiceClient();

  const { data: invite } = await service
    .from("class_invitations")
    .select("email, invited_role, status, expires_at, class:classes(title, course:courses(title))")
    .eq("token", token)
    .maybeSingle();

  if (!invite) {
    return NextResponse.json({ valid: false, reason: "not_found" });
  }
  if (invite.status !== "pending") {
    return NextResponse.json({ valid: false, reason: invite.status });
  }
  if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
    return NextResponse.json({ valid: false, reason: "expired" });
  }

  // Does this email already have an account? Drives sign-in vs sign-up.
  const { data: existingUser } = await service
    .from("users")
    .select("id")
    .eq("email", invite.email)
    .maybeSingle();

  const rawClass = invite.class as any;
  const cls = Array.isArray(rawClass) ? rawClass[0] : rawClass;
  const rawCourse = cls?.course as any;
  const course = Array.isArray(rawCourse) ? rawCourse[0] : rawCourse;

  return NextResponse.json({
    valid: true,
    email: invite.email,
    invited_role: invite.invited_role,
    class_title: cls?.title ?? null,
    course_title: course?.title ?? null,
    is_new_user: !existingUser,
  });
}
