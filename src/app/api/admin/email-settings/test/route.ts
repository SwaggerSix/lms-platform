import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/auth/authorize";
import { createServiceClient } from "@/lib/supabase/service";
import { sendEmail, invalidateEmailConfigCache } from "@/lib/email/sender";

/**
 * POST /api/admin/email-settings/test — send a test email to a recipient
 * (defaults to the signed-in admin) using the current configuration.
 */
export async function POST(request: NextRequest) {
  const auth = await authorize("admin", "super_admin");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json().catch(() => ({}));
  const service = createServiceClient();
  const { data: profile } = await service.from("users").select("email, first_name").eq("id", auth.user.id).single();
  const to = (typeof body.to === "string" && body.to.trim()) || profile?.email;
  if (!to) return NextResponse.json({ error: "No recipient address" }, { status: 400 });

  // Pick up any just-saved config.
  invalidateEmailConfigCache();

  const result = await sendEmail({
    to,
    subject: "LearnHub email delivery test",
    html: `<p>Hi ${profile?.first_name ?? "there"},</p><p>This is a test email confirming your LearnHub email delivery is configured correctly.</p>`,
    text: "This is a test email confirming your LearnHub email delivery is configured correctly.",
  });

  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error }, { status: 502 });
  }
  return NextResponse.json({ success: true, to });
}
