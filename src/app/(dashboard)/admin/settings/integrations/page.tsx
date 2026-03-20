import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import IntegrationsClient from "./integrations-client";

export const metadata: Metadata = {
  title: "Integrations | LMS Platform",
  description: "Configure video conferencing integrations for ILT sessions",
};

export default async function IntegrationsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

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
  const { data: integrationRows } = await service
    .from("vc_integrations")
    .select("id, provider, is_active, client_id, settings, token_expires_at, created_at, updated_at")
    .order("provider");

  const integrations = (integrationRows ?? []).map((row: any) => ({
    id: row.id,
    provider: row.provider as "zoom" | "teams" | "google_meet",
    is_active: row.is_active,
    has_client_id: !!row.client_id,
    has_credentials: !!row.client_id,
    settings: row.settings || {},
    token_expires_at: row.token_expires_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));

  return <IntegrationsClient initialIntegrations={integrations} />;
}
