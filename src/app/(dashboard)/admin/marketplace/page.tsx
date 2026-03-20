import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import AdminMarketplaceClient from "./admin-marketplace-client";

export const metadata: Metadata = {
  title: "Content Marketplace | LMS Platform",
  description: "Manage third-party content provider integrations",
};

export default async function AdminMarketplacePage() {
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

  // Fetch providers with course counts
  const { data: providers } = await service
    .from("marketplace_providers")
    .select("*, course_count:marketplace_courses(count)")
    .order("created_at", { ascending: false });

  const mappedProviders = (providers ?? []).map((p) => ({
    ...p,
    course_count: (p.course_count as any)?.[0]?.count || 0,
  }));

  // Get overall stats
  const { count: totalCourses } = await service
    .from("marketplace_courses")
    .select("*", { count: "exact", head: true })
    .eq("is_active", true);

  const { count: totalEnrollments } = await service
    .from("marketplace_enrollments")
    .select("*", { count: "exact", head: true });

  const stats = {
    totalProviders: mappedProviders.length,
    activeProviders: mappedProviders.filter((p) => p.is_active).length,
    totalCourses: totalCourses || 0,
    totalEnrollments: totalEnrollments || 0,
  };

  return (
    <AdminMarketplaceClient
      initialProviders={mappedProviders}
      stats={stats}
    />
  );
}
