import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import FeedbackCyclesClient from "./feedback-cycles-client";

export const metadata: Metadata = {
  title: "360-Degree Feedback | LMS Platform",
  description: "Manage feedback cycles, nominations, and reviews",
};

export default async function AdminFeedbackPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const service = createServiceClient();
  const { data: dbUser } = await service
    .from("users")
    .select("id, role")
    .eq("auth_id", user.id)
    .single();
  if (!dbUser || !["admin", "manager"].includes(dbUser.role)) redirect("/dashboard");

  const { data: cycles } = await service
    .from("feedback_cycles")
    .select("*, creator:users!feedback_cycles_created_by_fkey(id, first_name, last_name)")
    .order("created_at", { ascending: false });

  return <FeedbackCyclesClient cycles={cycles || []} />;
}
