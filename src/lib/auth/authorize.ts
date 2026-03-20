import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export type Role = "super_admin" | "admin" | "manager" | "instructor" | "learner";

export async function authorize(...allowedRoles: Role[]) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { authorized: false, error: "Not authenticated", status: 401 } as const;

  // Use service client to bypass RLS (avoids infinite recursion in users policy)
  const service = createServiceClient();
  const { data: dbUser } = await service
    .from("users")
    .select("id, role")
    .eq("auth_id", user.id)
    .single();

  if (!dbUser) return { authorized: false, error: "User not found", status: 404 } as const;

  // super_admin always has access to everything
  if (dbUser.role === "super_admin") {
    return { authorized: true, user: dbUser, supabase } as const;
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(dbUser.role as Role)) {
    return { authorized: false, error: "Insufficient permissions", status: 403 } as const;
  }

  return { authorized: true, user: dbUser, supabase } as const;
}
