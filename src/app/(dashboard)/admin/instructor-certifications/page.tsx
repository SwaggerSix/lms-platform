import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import AdminCertsClient from "./admin-certs-client";

export const metadata: Metadata = { title: "Instructor Certifications | LMS Platform" };

export default async function AdminInstructorCertsPage() {
  const supabase = await createClient();
  const service = createServiceClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await service.from("users").select("role").eq("auth_id", user.id).single();
  if (!profile || !["admin", "super_admin", "manager"].includes(profile.role)) redirect("/dashboard");
  return <AdminCertsClient />;
}
