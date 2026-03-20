import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import TenantsListClient from "./tenants-list-client";

export const metadata: Metadata = {
  title: "Manage Tenants | LMS Platform",
  description: "View and manage all tenant portals",
};

export default async function TenantsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const service = createServiceClient();
  const { data: dbUser } = await service
    .from("users")
    .select("id, role")
    .eq("auth_id", user.id)
    .single();
  if (!dbUser || dbUser.role !== "admin" && dbUser.role !== "super_admin") redirect("/dashboard");

  const { data: tenants } = await service
    .from("tenants")
    .select("*, owner:users!tenants_owner_id_fkey(id, first_name, last_name, email)")
    .order("created_at", { ascending: false });

  // Get counts for each tenant
  const tenantsWithCounts = await Promise.all(
    (tenants || []).map(async (t: any) => {
      const [{ count: memberCount }, { count: courseCount }] = await Promise.all([
        service.from("tenant_memberships").select("id", { count: "exact", head: true }).eq("tenant_id", t.id),
        service.from("tenant_courses").select("id", { count: "exact", head: true }).eq("tenant_id", t.id),
      ]);
      return { ...t, member_count: memberCount || 0, course_count: courseCount || 0 };
    })
  );

  return <TenantsListClient tenants={tenantsWithCounts} />;
}
