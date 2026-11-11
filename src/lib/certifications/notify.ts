/**
 * Emails to a learner about a staff-awarded credential: awarded ("you're
 * certified", which MOS-100 M10 promises) and revoked. Best effort — a failed
 * send never undoes the award or the revoke.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email/sender";
import { customTemplate } from "@/lib/email/templates";

const appUrl = () => (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");

function longDate(iso: string | null | undefined) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
}

async function load(service: SupabaseClient, userCertificationId: string) {
  const { data } = await service
    .from("user_certifications")
    .select(
      "issued_at, expires_at, user:users!user_certifications_user_id_fkey(email, first_name), certification:certifications(name)"
    )
    .eq("id", userCertificationId)
    .maybeSingle();
  const user = data?.user as { email?: string | null; first_name?: string | null } | null;
  const cert = data?.certification as { name?: string | null } | null;
  if (!data || !user?.email) return null;
  return {
    email: user.email,
    firstName: user.first_name || "there",
    name: cert?.name || "your certification",
    issuedAt: data.issued_at as string | null,
    expiresAt: data.expires_at as string | null,
  };
}

export async function sendAwardedEmail(service: SupabaseClient, userCertificationId: string) {
  const c = await load(service, userCertificationId);
  if (!c) return;
  const until = longDate(c.expiresAt);
  const tpl = customTemplate({
    subject: `You're certified: ${c.name}`,
    bodyText:
      `Hi ${c.firstName},\n\n` +
      `Congratulations. You've passed every gate, and you are now ${c.name}.` +
      (until ? ` Your certification is valid until ${until}.` : "") +
      `\n\nYour certificate is on your Certifications page, where you can download it and share its verification link.`,
    ctaText: "View your certificate",
    ctaUrl: `${appUrl()}/learn/certifications`,
  });
  await sendEmail({ to: c.email, subject: tpl.subject, html: tpl.html, text: tpl.text });
}

export async function sendRevokedEmail(service: SupabaseClient, userCertificationId: string) {
  const c = await load(service, userCertificationId);
  if (!c) return;
  const tpl = customTemplate({
    subject: `${c.name}: certification no longer active`,
    bodyText:
      `Hi ${c.firstName},\n\n` +
      `Your ${c.name} certification is no longer active. If you weren't expecting this, please reply to your assessor.`,
  });
  await sendEmail({ to: c.email, subject: tpl.subject, html: tpl.html, text: tpl.text });
}
