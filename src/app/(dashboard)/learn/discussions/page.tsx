import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DiscussionsClient from "./discussions-client";
import type { Thread, Reply } from "./discussions-client";

export const metadata: Metadata = {
  title: "Discussions | LMS Platform",
  description: "Participate in course discussions and connect with fellow learners",
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Map a category/course name to a Tailwind color pair. */
function courseColor(name: string): string {
  const map: Record<string, string> = {
    "Data Science": "bg-blue-100 text-blue-700",
    Leadership: "bg-purple-100 text-purple-700",
    "Project Management": "bg-green-100 text-green-700",
    Safety: "bg-red-100 text-red-700",
    "Cloud Architecture": "bg-cyan-100 text-cyan-700",
  };
  return map[name] ?? "bg-gray-100 text-gray-700";
}

/** Get initials from first + last name. */
function initials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

/** Human-friendly relative time string. */
function timeAgo(date: string | Date): string {
  const now = Date.now();
  const then = new Date(date).getTime();
  const seconds = Math.floor((now - then) / 1000);

  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  const weeks = Math.floor(days / 7);
  return `${weeks} week${weeks === 1 ? "" : "s"} ago`;
}

/* ------------------------------------------------------------------ */
/*  Page (Server Component)                                            */
/* ------------------------------------------------------------------ */

export default async function DiscussionsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Get the current user record
  const { data: dbUser } = await supabase
    .from("users")
    .select("id, first_name, last_name")
    .eq("auth_id", user.id)
    .single();

  const currentUserName = dbUser
    ? `${dbUser.first_name} ${dbUser.last_name}`
    : "User";
  const currentUserInitials = dbUser
    ? initials(dbUser.first_name, dbUser.last_name)
    : "U";

  // Fetch top-level discussion threads (parent_id IS NULL means root threads)
  const { data: threadsData } = await supabase
    .from("discussions")
    .select(
      `
      id,
      title,
      body,
      upvotes,
      created_at,
      user:users!discussions_user_id_fkey(id, first_name, last_name),
      course:courses!discussions_course_id_fkey(title)
    `
    )
    .is("parent_id", null)
    .order("created_at", { ascending: false });

  // Gather all thread IDs so we can fetch replies in one query
  const threadIds = (threadsData ?? []).map((t: any) => t.id);

  // Fetch all replies for these threads
  const { data: repliesData } = threadIds.length > 0
    ? await supabase
        .from("discussions")
        .select(
          `
        id,
        parent_id,
        body,
        created_at,
        user:users!discussions_user_id_fkey(first_name, last_name)
      `
        )
        .in("parent_id", threadIds)
        .order("created_at", { ascending: true })
    : { data: [] as any[] };

  // Group replies by parent thread
  const repliesByThread: Record<string, any[]> = {};
  for (const reply of repliesData ?? []) {
    const pid = reply.parent_id as string;
    if (!repliesByThread[pid]) repliesByThread[pid] = [];
    repliesByThread[pid].push(reply);
  }

  // Map to the client's Thread interface
  const threads: Thread[] = (threadsData ?? []).map((t: any) => {
    const authorFirst = t.user?.first_name ?? "Unknown";
    const authorLast = t.user?.last_name ?? "";
    const courseName = t.course?.title ?? "General";
    const threadReplies = repliesByThread[t.id] ?? [];

    const mappedReplies: Reply[] = threadReplies.map((r: any) => {
      const rFirst = r.user?.first_name ?? "Unknown";
      const rLast = r.user?.last_name ?? "";
      return {
        id: r.id,
        author: `${rFirst} ${rLast}`.trim(),
        initials: initials(rFirst, rLast),
        text: r.body,
        timeAgo: timeAgo(r.created_at),
      };
    });

    return {
      id: t.id,
      title: t.title ?? "(Untitled)",
      body: t.body,
      author: `${authorFirst} ${authorLast}`.trim(),
      authorInitials: initials(authorFirst, authorLast),
      course: courseName,
      courseColor: courseColor(courseName),
      timeAgo: timeAgo(t.created_at),
      replies: threadReplies.length,
      upvotes: t.upvotes ?? 0,
      mockReplies: mappedReplies,
    };
  });

  return (
    <DiscussionsClient
      threads={threads}
      currentUserInitials={currentUserInitials}
      currentUserName={currentUserName}
    />
  );
}
