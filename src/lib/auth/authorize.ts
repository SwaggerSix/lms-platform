import { createClient } from "@/lib/supabase/server";

export type Role = "admin" | "manager" | "instructor" | "learner";

export async function authorize(...allowedRoles: Role[]) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { authorized: false, error: "Not authenticated", status: 401 } as const;

  const { data: dbUser } = await supabase
    .from("users")
    .select("id, role")
    .eq("auth_id", user.id)
    .single();

  if (!dbUser) return { authorized: false, error: "User not found", status: 404 } as const;

  if (allowedRoles.length > 0 && !allowedRoles.includes(dbUser.role as Role)) {
    return { authorized: false, error: "Insufficient permissions", status: 403 } as const;
  }

  return { authorized: true, user: dbUser, supabase } as const;
}
