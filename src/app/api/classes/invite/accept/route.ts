import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/auth/authorize";
import { createServiceClient } from "@/lib/supabase/service";
import { validateBody, acceptInviteSchema } from "@/lib/validations";

/**
 * POST /api/classes/invite/accept
 * Accept a class invitation. The caller must be authenticated and their email
 * must match the invitation. Learners are also enrolled in the underlying
 * course so their progress/transcript tracking works as usual.
 */
export async function POST(request: NextRequest) {
  const auth = await authorize();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json();
  const validation = validateBody(acceptInviteSchema, body);
  if (!validation.success) return NextResponse.json({ error: validation.error }, { status: 400 });

  const service = createServiceClient();

  const { data: invite } = await service
    .from("class_invitations")
    .select("*")
    .eq("token", validation.data.token)
    .maybeSingle();

  if (!invite || invite.status === "revoked") {
    return NextResponse.json({ error: "Invalid invitation" }, { status: 404 });
  }
  if (invite.status === "accepted") {
    // Idempotent: already accepted — just point the user at the class.
    return NextResponse.json({ success: true, class_id: invite.class_id });
  }
  if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
    await service.from("class_invitations").update({ status: "expired" }).eq("id", invite.id);
    return NextResponse.json({ error: "Invitation has expired" }, { status: 410 });
  }

  // Email must match the authenticated user.
  const { data: userRecord } = await service
    .from("users")
    .select("email")
    .eq("id", auth.user.id)
    .single();
  if (userRecord && userRecord.email.toLowerCase() !== invite.email.toLowerCase()) {
    return NextResponse.json(
      { error: "This invitation was sent to a different email address" },
      { status: 403 }
    );
  }

  // The class (for the course_id) so we can enroll learners in the course.
  const { data: cls } = await service
    .from("classes")
    .select("course_id")
    .eq("id", invite.class_id)
    .single();
  if (!cls) return NextResponse.json({ error: "Class not found" }, { status: 404 });

  // Add (or reactivate) the roster entry.
  const { error: participantErr } = await service
    .from("class_participants")
    .upsert(
      {
        class_id: invite.class_id,
        user_id: auth.user.id,
        role: invite.invited_role,
        status: "active",
        invited_by: invite.invited_by,
      },
      { onConflict: "class_id,user_id" }
    );
  if (participantErr) {
    console.error("Class participant upsert error:", participantErr.message);
    return NextResponse.json({ error: "Failed to join class" }, { status: 500 });
  }

  // Learners get a course enrollment (idempotent on user_id+course_id).
  if (invite.invited_role === "learner") {
    const { data: existingEnrollment } = await service
      .from("enrollments")
      .select("id")
      .eq("user_id", auth.user.id)
      .eq("course_id", cls.course_id)
      .maybeSingle();
    if (!existingEnrollment) {
      await service.from("enrollments").insert({
        user_id: auth.user.id,
        course_id: cls.course_id,
        status: "enrolled",
        assigned_by: invite.invited_by,
      });
    }
  }

  await service
    .from("class_invitations")
    .update({ status: "accepted", accepted_at: new Date().toISOString(), accepted_by: auth.user.id })
    .eq("id", invite.id);

  return NextResponse.json({ success: true, class_id: invite.class_id });
}
