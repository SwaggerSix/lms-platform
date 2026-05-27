import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { redirect } from "next/navigation";
import AdminNudgesClient from "./admin-nudges-client";

export const metadata: Metadata = {
  title: "Nudges Admin | LMS Platform",
  description: "Manage the nudge action library and campaigns",
};

export default async function AdminNudgesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const service = createServiceClient();
  const { data: dbUser } = await service
    .from("users")
    .select("id, role, organization_id")
    .eq("auth_id", user.id)
    .single();
  if (!dbUser) redirect("/login");
  if (!["admin", "super_admin"].includes(dbUser.role)) redirect("/dashboard");

  const [actionsRes, campaignsRes] = await Promise.all([
    service.from("nudge_actions").select("*").order("created_at", { ascending: false }),
    service.from("nudge_campaigns").select("*").order("created_at", { ascending: false }),
  ]);

  return (
    <AdminNudgesClient
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      initialActions={(actionsRes.data ?? []) as any}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      initialCampaigns={(campaignsRes.data ?? []) as any}
    />
  );
}
