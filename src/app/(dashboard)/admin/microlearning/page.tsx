import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import AdminMicrolearningClient from "./admin-microlearning-client";

export const metadata: Metadata = {
  title: "Manage Microlearning | LMS Platform",
  description: "Create and manage microlearning nuggets and embed widgets",
};

export default async function AdminMicrolearningPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const service = createServiceClient();
  const { data: dbUser } = await service
    .from("users")
    .select("id, role")
    .eq("auth_id", user.id)
    .single();
  if (!dbUser || !["admin", "instructor"].includes(dbUser.role)) redirect("/dashboard");

  // Fetch all nuggets
  const { data: nuggets, count: nuggetCount } = await service
    .from("microlearning_nuggets")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .limit(50);

  // Fetch widgets
  const { data: widgets } = await service
    .from("embed_widgets")
    .select("*")
    .order("created_at", { ascending: false });

  // Aggregate stats
  const { data: progressData } = await service
    .from("microlearning_progress")
    .select("status");

  const stats = {
    totalNuggets: nuggetCount || 0,
    totalViews: (nuggets ?? []).reduce((sum, n) => sum + (n.view_count || 0), 0),
    totalCompletions: (progressData ?? []).filter((p) => p.status === "completed").length,
    totalWidgets: (widgets ?? []).length,
  };

  return (
    <AdminMicrolearningClient
      initialNuggets={nuggets ?? []}
      initialWidgets={widgets ?? []}
      stats={stats}
    />
  );
}
