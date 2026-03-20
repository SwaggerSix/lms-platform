import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import ChatPageClient from "./chat-page-client";

export const metadata: Metadata = {
  title: "AI Learning Assistant | LMS Platform",
  description: "Chat with your AI learning assistant for help with courses, assessments, and career guidance",
};

export default async function ChatPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const service = createServiceClient();
  const { data: dbUser } = await service
    .from("users")
    .select("id, first_name, last_name")
    .eq("auth_id", user.id)
    .single();
  if (!dbUser) redirect("/login");

  return <ChatPageClient userName={`${dbUser.first_name} ${dbUser.last_name}`} />;
}
