import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/auth/authorize";
import { createServiceClient } from "@/lib/supabase/service";
import { sendEmail } from "@/lib/email/sender";
import { accountInvitation } from "@/lib/email/templates";

/**
 * POST /api/users/[id]/resend-invite
 * Re-sends an account invitation: generates a fresh set-password (recovery)
 * link and emails it. Returns the link as a fallback if email isn't delivered.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await authorize("admin", "super_admin");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const service = createServiceClient();
  const { data: user } = await service
    .from("users")
    .select("id, email, first_name, preferences")
    .eq("id", id)
    .single();
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const base = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
  const { data: link, error: linkErr } = await service.auth.admin.generateLink({
    type: "recovery",
    email: user.email,
    options: { redirectTo: `${base}/reset-password` },
  });
  if (linkErr || !link?.properties?.action_link) {
    console.error("Resend invite link error:", linkErr?.message);
    return NextResponse.json({ error: "Could not generate an invitation link" }, { status: 500 });
  }
  const actionUrl = link.properties.action_link;

  // Flag that they still need to set their password.
  await service
    .from("users")
    .update({ preferences: { ...(user.preferences as Record<string, unknown> ?? {}), must_change_password: true } })
    .eq("id", id);

  const template = accountInvitation({ name: user.first_name || "there", actionUrl });
  const emailed = await sendEmail({ to: user.email, subject: template.subject, html: template.html, text: template.text });

  return NextResponse.json({
    success: true,
    emailed: emailed.success,
    // Fallback for the admin to share manually only when email delivery failed.
    ...(emailed.success ? {} : { action_link: actionUrl }),
  });
}
