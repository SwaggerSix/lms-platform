import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import SSOClient from "./sso-client";

export const metadata: Metadata = {
  title: "SSO Configuration | LMS Platform",
  description: "Configure SAML 2.0 SSO and SCIM provisioning for your organization",
};

export default async function SSOSettingsPage() {
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

  if (!dbUser) {
    redirect("/login");
  }

  if (dbUser.role !== "admin" && dbUser.role !== "super_admin") {
    redirect("/dashboard");
  }

  // Fetch SSO providers
  const { data: providers } = await service
    .from("sso_providers")
    .select("*")
    .order("created_at", { ascending: false });

  // Sanitize: don't pass scim_token_hash to client
  const sanitizedProviders = (providers ?? []).map(({ scim_token_hash, ...rest }: any) => ({
    ...rest,
    has_scim_token: !!scim_token_hash,
  }));

  const supabaseProjectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

  return (
    <SSOClient
      initialProviders={sanitizedProviders}
      supabaseProjectUrl={supabaseProjectUrl}
    />
  );
}
