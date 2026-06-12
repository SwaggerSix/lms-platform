import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { resolveEnabledFeatures } from "@/lib/features/resolve";

// GET /api/features
// Returns the effective feature-enablement map for the current user, resolved
// against their tenant (or platform defaults for users without a tenant).
// Used by the sidebar and other client UI to hide disabled functionality.
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const service = createServiceClient();

  const { data: profile } = await service
    .from("users")
    .select("id, role")
    .eq("auth_id", user.id)
    .single();

  // Platform admins are not tenant-scoped: resolve against platform defaults.
  let tenantId: string | null = null;
  if (profile && profile.role !== "admin" && profile.role !== "super_admin") {
    const { data: membership } = await service
      .from("tenant_memberships")
      .select("tenant_id")
      .eq("user_id", profile.id)
      .limit(1)
      .single();
    tenantId = membership?.tenant_id ?? null;
  }

  const features = await resolveEnabledFeatures(service, tenantId);
  return NextResponse.json({ features });
}
