import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import TenantDetailClient from "./tenant-detail-client";

export const metadata: Metadata = {
  title: "Tenant Details | LMS Platform",
  description: "View and manage tenant portal settings",
};

export default async function TenantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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

  const { data: tenant, error } = await service
    .from("tenants")
    .select("*, owner:users!tenants_owner_id_fkey(id, first_name, last_name, email)")
    .eq("id", id)
    .single();

  if (error || !tenant) redirect("/admin/tenants");

  const [{ data: members }, { data: courses }, { data: invitations }] = await Promise.all([
    service
      .from("tenant_memberships")
      .select("id, role, joined_at, user:users(id, first_name, last_name, email, role)")
      .eq("tenant_id", id)
      .order("joined_at", { ascending: true }),
    service
      .from("tenant_courses")
      .select("id, is_featured, custom_price, created_at, course:courses(id, title, slug, status, thumbnail_url)")
      .eq("tenant_id", id)
      .order("created_at", { ascending: false }),
    service
      .from("tenant_invitations")
      .select("id, email, role, token, expires_at, accepted_at, created_at")
      .eq("tenant_id", id)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  // Get available courses for the assign dropdown
  const { data: allCourses } = await service
    .from("courses")
    .select("id, title, slug, status")
    .eq("status", "published")
    .order("title", { ascending: true });

  // Get available users for the add-member dropdown
  const { data: allUsers } = await service
    .from("users")
    .select("id, first_name, last_name, email")
    .order("last_name", { ascending: true })
    .limit(200);

  return (
    <TenantDetailClient
      tenant={tenant}
      members={members || []}
      courses={courses || []}
      invitations={invitations || []}
      allCourses={allCourses || []}
      allUsers={allUsers || []}
    />
  );
}
