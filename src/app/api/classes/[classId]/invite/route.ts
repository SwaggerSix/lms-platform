import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/auth/authorize";
import { createServiceClient } from "@/lib/supabase/service";
import { rateLimit } from "@/lib/rate-limit";
import { validateBody, classInviteSchema } from "@/lib/validations";
import { generateInviteToken } from "@/lib/tenants/tenant-context";
import { sendEmail } from "@/lib/email/sender";
import { classInvitation } from "@/lib/email/templates";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * POST /api/classes/[classId]/invite
 * Invite one or more people (by email) to a class. Supports bulk.
 * Existing users and brand-new emails are both supported — new users are
 * routed through sign-up when they accept.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ classId: string }> }
) {
  const { classId } = await params;
  const auth = await authorize("admin", "instructor");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const rl = await rateLimit(`class-invite-${auth.user.id}`, 10, 60000);
  if (!rl.success) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });

  const body = await request.json();
  const validation = validateBody(classInviteSchema, body);
  if (!validation.success) return NextResponse.json({ error: validation.error }, { status: 400 });

  const service = createServiceClient();

  // Load the class + course for the invitation email.
  const { data: cls } = await service
    .from("classes")
    .select("id, title, start_date, course:courses(title)")
    .eq("id", classId)
    .single();
  if (!cls) return NextResponse.json({ error: "Class not found" }, { status: 404 });
  const rawCourse = cls.course as any;
  const courseTitle = (Array.isArray(rawCourse) ? rawCourse[0] : rawCourse)?.title;

  // Inviter name for the email.
  const { data: inviter } = await service
    .from("users")
    .select("first_name, last_name")
    .eq("id", auth.user.id)
    .single();
  const inviterName = inviter ? `${inviter.first_name} ${inviter.last_name}` : undefined;

  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
  const role = validation.data.role;
  const emails = [...new Set(validation.data.emails.map((e) => e.trim().toLowerCase()))];

  const results: { email: string; status: "invited" | "skipped"; reason?: string }[] = [];

  for (const email of emails) {
    // Skip if already an active participant.
    const { data: existingUser } = await service
      .from("users")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (existingUser) {
      const { data: existingParticipant } = await service
        .from("class_participants")
        .select("id")
        .eq("class_id", classId)
        .eq("user_id", existingUser.id)
        .eq("status", "active")
        .maybeSingle();
      if (existingParticipant) {
        results.push({ email, status: "skipped", reason: "Already a participant" });
        continue;
      }
    }

    // Skip if there's already a pending, unexpired invitation.
    const { data: pending } = await service
      .from("class_invitations")
      .select("id")
      .eq("class_id", classId)
      .eq("email", email)
      .eq("status", "pending")
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (pending) {
      results.push({ email, status: "skipped", reason: "Pending invitation exists" });
      continue;
    }

    const token = generateInviteToken();
    const { error: insErr } = await service.from("class_invitations").insert({
      class_id: classId,
      email,
      invited_role: role,
      token,
      status: "pending",
      expires_at: new Date(Date.now() + INVITE_TTL_MS).toISOString(),
      invited_by: auth.user.id,
    });
    if (insErr) {
      console.error("Class invite insert error:", insErr.message);
      results.push({ email, status: "skipped", reason: "Failed to create invitation" });
      continue;
    }

    const acceptUrl = `${baseUrl}/invite/accept/${token}`;
    const template = classInvitation({
      className: cls.title,
      courseName: courseTitle,
      inviterName,
      invitedRole: role,
      startDate: cls.start_date ?? undefined,
      acceptUrl,
      isNewUser: !existingUser,
    });
    await sendEmail({ to: email, subject: template.subject, html: template.html, text: template.text });

    results.push({ email, status: "invited" });
  }

  const invited = results.filter((r) => r.status === "invited").length;
  return NextResponse.json({ invited, skipped: results.length - invited, results }, { status: 201 });
}

/**
 * GET /api/classes/[classId]/invite — list invitations for a class.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ classId: string }> }
) {
  const { classId } = await params;
  const auth = await authorize("admin", "instructor");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const service = createServiceClient();
  const { data, error } = await service
    .from("class_invitations")
    .select("id, email, invited_role, status, expires_at, accepted_at, created_at")
    .eq("class_id", classId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Class invitations GET error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
  return NextResponse.json({ invitations: data ?? [] });
}

/**
 * DELETE /api/classes/[classId]/invite?id=<invitationId> — revoke an invitation.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ classId: string }> }
) {
  const { classId } = await params;
  const auth = await authorize("admin", "instructor");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const invitationId = new URL(request.url).searchParams.get("id");
  if (!invitationId) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const service = createServiceClient();
  const { error } = await service
    .from("class_invitations")
    .update({ status: "revoked" })
    .eq("id", invitationId)
    .eq("class_id", classId)
    .eq("status", "pending");

  if (error) {
    console.error("Class invitation revoke error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
