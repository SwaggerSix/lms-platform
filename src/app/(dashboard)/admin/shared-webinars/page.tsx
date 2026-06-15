import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import SharedWebinarsClient from "./shared-webinars-client";

export const metadata: Metadata = {
  title: "Shared Webinars | LMS Platform",
  description: "Opt your client instance into free shared webinars",
};

export default async function SharedWebinarsPage() {
  const supabase = await createClient();
  const service = createServiceClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await service.from("users").select("role").eq("auth_id", user.id).single();
  if (!profile || !["admin", "super_admin", "manager"].includes(profile.role)) redirect("/dashboard");
  return <SharedWebinarsClient />;
}
