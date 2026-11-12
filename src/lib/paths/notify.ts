import type { createServiceClient } from "@/lib/supabase/service";
import { sendEmail } from "@/lib/email/sender";
import { learningPathAccess } from "@/lib/email/templates";
import { generateSetPasswordLink, hasNeverSignedIn } from "@/lib/users/set-password-link";

type Service = ReturnType<typeof createServiceClient>;

export type PathEmailOutcome =
  /** Emailed a link to the path. */
  | "emailed"
  /** Emailed a set-password link (they had never signed in). */
  | "emailed_setup"
  /** User-ID account: no inbox, nothing to send. */
  | "no_inbox"
  /** Tried and failed (email not configured, provider error, no link). */
  | "failed";

/**
 * Emails someone who was just given a learning path.
 *
 * If they have never signed in they have no password they know — accounts are
 * created with a random temporary one — so the email carries a set-password
 * link instead of a plain link to the path. Without this, people added under
 * Admin → Users and then assigned a path had no way in.
 */
export async function emailPathAccess(
  service: Service,
  opts: {
    user: { email: string; first_name?: string | null; auth_id?: string | null; login_id?: string | null };
    path: { title: string; slug?: string | null };
    courseCount: number;
    base: string;
    inviterName?: string;
  }
): Promise<PathEmailOutcome> {
  const { user, path, base } = opts;
  if (user.login_id || !user.email) return "no_inbox";

  const pathUrl = path.slug ? `${base}/learn/paths/${path.slug}` : `${base}/learn/paths`;
  let actionUrl = pathUrl;
  let isNewAccount = false;

  if (await hasNeverSignedIn(service, user.auth_id)) {
    const link = await generateSetPasswordLink(service, user.email, base);
    if (!link) return "failed";
    actionUrl = link;
    isNewAccount = true;
  }

  const tpl = learningPathAccess({
    name: user.first_name || "there",
    pathTitle: path.title,
    courseCount: opts.courseCount,
    actionUrl,
    isNewAccount,
    inviterName: opts.inviterName,
  });
  const sent = await sendEmail({ to: user.email, subject: tpl.subject, html: tpl.html, text: tpl.text });
  if (!sent.success) {
    console.error("Path access email failed:", sent.error);
    return "failed";
  }
  return isNewAccount ? "emailed_setup" : "emailed";
}
