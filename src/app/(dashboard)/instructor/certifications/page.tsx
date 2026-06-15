import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import CertificationsClient from "./certifications-client";

export const metadata: Metadata = { title: "My Certifications | LMS Platform" };

export default async function MyCertificationsPage() {
  const supabase = await createClient();
  const service = createServiceClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await service.from("users").select("role").eq("auth_id", user.id).single();
  if (!profile || !["instructor", "admin", "super_admin"].includes(profile.role)) redirect("/dashboard");
  return <CertificationsClient />;
}
