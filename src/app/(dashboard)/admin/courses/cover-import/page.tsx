import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import CoverImportClient from "./cover-import-client";

export const metadata: Metadata = {
  title: "Bulk Cover Images | LMS Platform",
  description: "Bulk-set course cover images from a spreadsheet, with licensing provenance",
};

export default async function CoverImportPage() {
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

  return <CoverImportClient />;
}
