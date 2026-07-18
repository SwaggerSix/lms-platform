import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { VIEW_AS_COOKIE, resolveViewAsRole } from "@/lib/auth/view-as";
import {
  defaultPermissionsForRole,
  resolveEffectivePermissions,
} from "@/lib/auth/permissions";

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

  // Effective permissions (custom-role overlay). Loaded defensively: a missing
  // custom_roles table/column (e.g. code deployed ahead of the migration)
  // degrades to the base role's defaults rather than failing the whole profile
  // fetch. While previewing a role, permissions reflect that built-in base role
  // with no custom overlay.
  let permissions: string[];
  let customRole: { id: string; name: string } | null = null;
  if (viewingAs) {
    permissions = defaultPermissionsForRole(viewingAs);
  } else {
    try {
      const { data: cr } = await service
        .from("users")
        .select("custom_role:custom_roles(id, name, permissions, base_role, is_active)")
        .eq("id", data.id)
        .maybeSingle();
      const embedded = (cr as { custom_role?: { id: string; name: string; permissions: string[]; base_role: string; is_active: boolean } | null } | null)?.custom_role ?? null;
      if (embedded && embedded.is_active !== false) {
        customRole = { id: embedded.id, name: embedded.name };
        permissions = resolveEffectivePermissions({
          role: data.role,
          customRolePermissions: embedded.permissions ?? [],
          customRoleBaseRole: embedded.base_role,
        });
      } else {
        permissions = defaultPermissionsForRole(data.role);
      }
    } catch {
      permissions = defaultPermissionsForRole(data.role);
    }
  }

  if (viewingAs) {
    return NextResponse.json({ ...data, role: viewingAs, real_role: data.role, permissions, custom_role: customRole });
  }

  return NextResponse.json({ ...data, permissions, custom_role: customRole });
}
