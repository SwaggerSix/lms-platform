import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import CreateTenantWizard from "./create-tenant-wizard";

export const metadata: Metadata = {
  title: "Create Tenant | LMS Platform",
  description: "Create a new tenant portal",
};

export default async function NewTenantPage() {
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

  return <CreateTenantWizard />;
}
