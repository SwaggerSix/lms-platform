import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { VIEW_AS_COOKIE, resolveViewAsRole } from "@/lib/auth/view-as";

export async function GET() {
  // Verify the user is authenticated via their session cookie
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Use service client to bypass RLS (avoids infinite recursion in users policy)
  const service = createServiceClient();
  const { data, error } = await service
    .from("users")
    .select("id, first_name, last_name, email, role, status, job_title, avatar_url, organization_id, manager_id, hire_date, preferences, created_at, organization:organizations(id, name, type)")
    .eq("auth_id", user.id)
    .single();

  if (error) {
    console.error("Profile fetch error:", error.message);
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  // Read-only role preview (§2.12): when an admin is previewing another role,
  // report the previewed role as `role` so the whole client UI (sidebar, header,
  // role-gated controls) renders as that role. The real role is preserved on
  // `real_role` so the "view as" switcher itself stays available.
  const cookieStore = await cookies();
  const viewingAs = resolveViewAsRole(
    data.role,
    cookieStore.get(VIEW_AS_COOKIE)?.value ?? null
  );

  if (viewingAs) {
    return NextResponse.json({ ...data, role: viewingAs, real_role: data.role });
  }

  return NextResponse.json(data);
}
