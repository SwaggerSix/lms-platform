import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import CronHealthClient from "./cron-health-client";

export const metadata: Metadata = {
  title: "Cron Health | LMS Platform",
  description: "Status and run history of scheduled jobs",
};

export default async function CronHealthPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const service = createServiceClient();
  const { data: dbUser } = await service
    .from("users")
    .select("id, role")
    .eq("auth_id", user.id)
    .single();

  if (!dbUser || (dbUser.role !== "admin" && dbUser.role !== "super_admin")) {
    redirect("/dashboard");
  }

  return <CronHealthClient />;
}
