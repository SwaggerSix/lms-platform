import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import HRISIntegrationsClient from "./hris-client";

export const metadata: Metadata = {
  title: "HRIS/CRM Integrations | LMS Platform",
  description: "Configure HRIS and CRM integrations for user synchronization",
};

export default async function HRISIntegrationsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const service = createServiceClient();
  const { data: dbUser } = await service
    .from("users")
    .select("id, role")
    .eq("auth_id", user.id)
    .single();

  if (!dbUser || dbUser.role !== "admin" && dbUser.role !== "super_admin") {
    redirect("/dashboard");
  }

  // Fetch existing integrations
  const { data: integrations } = await service
    .from("external_integrations")
    .select("*")
    .order("created_at", { ascending: false });

  return <HRISIntegrationsClient initialIntegrations={integrations || []} />;
}
