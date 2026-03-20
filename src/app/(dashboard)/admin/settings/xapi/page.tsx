import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import XAPIClient from "./xapi-client";

export const metadata: Metadata = {
  title: "xAPI / LRS Settings | LMS Platform",
  description: "Configure xAPI Learning Record Store integrations and explore statement data",
};

export default async function XAPISettingsPage() {
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

  // Fetch LRS configurations
  const { data: configs } = await service
    .from("lrs_configurations")
    .select("*")
    .order("created_at", { ascending: false });

  // Sanitize secrets
  const sanitizedConfigs = (configs ?? []).map(({ password_encrypted, token_encrypted, ...rest }: any) => ({
    ...rest,
    has_password: !!password_encrypted,
    has_token: !!token_encrypted,
  }));

  // Fetch recent statements for explorer
  const { data: recentStatements, count: statementCount } = await service
    .from("xapi_statements")
    .select("*", { count: "exact" })
    .eq("voided", false)
    .order("stored_at", { ascending: false })
    .limit(25);

  return (
    <XAPIClient
      initialConfigs={sanitizedConfigs}
      initialStatements={recentStatements ?? []}
      totalStatements={statementCount ?? 0}
    />
  );
}
