import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import CatalogImportClient from "./catalog-import-client";

export const metadata: Metadata = {
  title: "Catalog Content Import | LMS Platform",
  description: "Upload a completed catalog audit to update product content",
};

export default async function CatalogImportPage() {
  const supabase = await createClient();
  const service = createServiceClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await service
    .from("users")
    .select("role")
    .eq("auth_id", user.id)
    .single();
  if (!profile || !["admin", "super_admin"].includes(profile.role)) {
    redirect("/dashboard");
  }

  return <CatalogImportClient />;
}
