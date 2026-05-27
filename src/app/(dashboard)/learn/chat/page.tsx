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

  // Courses the learner is working on (for the Course Help / Assessment Prep
  // pickers). Falls back to published courses if they have no enrollments yet.
  const { data: enrollmentRows } = await service
    .from("enrollments")
    .select("course:courses(id, title, status)")
    .eq("user_id", dbUser.id);

  const courseMap = new Map<string, { id: string; title: string }>();
  for (const row of (enrollmentRows ?? []) as any[]) {
    const c = row.course;
    if (c && c.status === "published") courseMap.set(c.id, { id: c.id, title: c.title });
  }

  if (courseMap.size === 0) {
    const { data: published } = await service
      .from("courses")
      .select("id, title")
      .eq("status", "published")
      .order("title", { ascending: true });
    for (const c of (published ?? []) as any[]) courseMap.set(c.id, { id: c.id, title: c.title });
  }

  const courses = Array.from(courseMap.values()).sort((a, b) =>
    a.title.localeCompare(b.title)
  );

  return (
    <ChatPageClient
      userName={`${dbUser.first_name} ${dbUser.last_name}`}
      courses={courses}
    />
  );
}
