import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Server-side helper: gets the authenticated user's profile.
 * Uses the service client to bypass RLS (avoids infinite recursion
 * in the users_select policy which references the users table itself).
 */
export async function getAuthUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { authUser: null, dbUser: null, supabase };

  const service = createServiceClient();
  const { data: dbUser } = await service
    .from("users")
    .select("*, organization:organizations(*)")
    .eq("auth_id", user.id)
    .single();

  return { authUser: user, dbUser, supabase };
}
