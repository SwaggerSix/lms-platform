import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { redirect } from "next/navigation";
import NudgesLearnerClient from "./nudges-client";

export const metadata: Metadata = {
  title: "My Nudges | LMS Platform",
  description: "Your daily MicroActions",
};

export default async function LearnerNudgesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const service = createServiceClient();
  const { data: dbUser } = await service.from("users").select("id").eq("auth_id", user.id).single();
  if (!dbUser) redirect("/login");

  const { data: assignments } = await service
    .from("nudge_assignments")
    .select("*, nudge_actions(title, description, estimated_minutes, image_url, quote, quote_author)")
    .eq("assignee_id", dbUser.id)
    .order("created_at", { ascending: false });

  const ids = (assignments ?? []).map((a) => a.id);
  const today = new Date().toISOString().split("T")[0];
  const [logsRes, streaksRes] = await Promise.all([
    ids.length ? service.from("nudge_daily_logs").select("*").eq("log_date", today).in("assignment_id", ids) : Promise.resolve({ data: [] }),
    ids.length ? service.from("nudge_streaks").select("*").in("assignment_id", ids) : Promise.resolve({ data: [] }),
  ]);
  const logMap = new Map((logsRes.data ?? []).map((l) => [l.assignment_id, l]));
  const streakMap = new Map((streaksRes.data ?? []).map((s) => [s.assignment_id, s]));

  const nudges = (assignments ?? []).map((a) => ({
    ...a,
    todayLog: logMap.get(a.id) ?? null,
    streak: streakMap.get(a.id) ?? null,
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <NudgesLearnerClient nudges={nudges as any} />;
}
