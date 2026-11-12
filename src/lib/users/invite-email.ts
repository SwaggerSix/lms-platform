import type { createServiceClient } from "@/lib/supabase/service";
import { sendEmail } from "@/lib/email/sender";
import { accountInvitation } from "@/lib/email/templates";
import { generateSetPasswordLink } from "@/lib/users/set-password-link";

/**
 * Emails an account invitation with a set-password link. Used by
 * Admin → Users → Add user (on by default) and → Resend invite.
 *
 * `link` is returned even when the email fails so the admin can share it
 * directly; it is null only if no link could be generated.
 */
export async function sendAccountInvite(
  service: ReturnType<typeof createServiceClient>,
  user: { email: string; first_name?: string | null },
  base: string,
  inviterName?: string
): Promise<{ link: string | null; emailed: boolean }> {
  const link = await generateSetPasswordLink(service, user.email, base);
  if (!link) return { link: null, emailed: false };
  const tpl = accountInvitation({ name: user.first_name || "there", actionUrl: link, inviterName });
  const sent = await sendEmail({ to: user.email, subject: tpl.subject, html: tpl.html, text: tpl.text });
  if (!sent.success) console.error("Account invitation email failed:", sent.error);
  return { link, emailed: sent.success };
}
