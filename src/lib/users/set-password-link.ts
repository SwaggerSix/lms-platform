import type { createServiceClient } from "@/lib/supabase/service";

type Service = ReturnType<typeof createServiceClient>;

/**
 * App base URL for links in emails: NEXT_PUBLIC_APP_URL, else the request's
 * own origin.
 */
export function appBaseUrl(requestUrl?: string): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  if (requestUrl) return new URL(requestUrl).origin;
  return "";
}

/**
 * A one-time set-password (recovery) link for an email account. This is what
 * "Resend invite", "Invite people" and now "Add user" and "Assign" email to
 * someone who has never signed in. Returns null if Supabase can't make one.
 */
export async function generateSetPasswordLink(
  service: Service,
  email: string,
  base: string
): Promise<string | null> {
  const { data, error } = await service.auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo: `${base}/reset-password` },
  });
  if (error || !data?.properties?.action_link) {
    console.error("Set-password link error:", error?.message);
    return null;
  }
  return data.properties.action_link;
}

/**
 * True when the account has never signed in, so it has no password the
 * person knows (accounts are created with a random temporary one).
 * If the auth record can't be read, assumes they have signed in (they get the
 * plain "go to your learning path" email rather than a password reset).
 */
export async function hasNeverSignedIn(service: Service, authId: string | null | undefined): Promise<boolean> {
  if (!authId) return false;
  try {
    const { data, error } = await service.auth.admin.getUserById(authId);
    if (error || !data?.user) return false;
    return !data.user.last_sign_in_at;
  } catch {
    return false;
  }
}
