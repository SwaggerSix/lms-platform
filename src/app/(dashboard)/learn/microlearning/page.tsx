import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import DailyFeed from "@/components/microlearning/daily-feed";

export const metadata: Metadata = {
  title: "Microlearning | LMS Platform",
  description: "Daily bite-sized learning nuggets to boost your skills",
};

export default async function MicrolearningPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const service = createServiceClient();
  const { data: dbUser } = await service
    .from("users")
    .select("id")
    .eq("auth_id", user.id)
    .single();
  if (!dbUser) redirect("/login");

  // Fetch initial nuggets
  const { data: nuggets } = await service
    .from("microlearning_nuggets")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(12);

  // Fetch user progress for these nuggets
  const nuggetIds = (nuggets ?? []).map((n) => n.id);
  let progressMap: Record<string, string> = {};
  if (nuggetIds.length > 0) {
    const { data: progress } = await service
      .from("microlearning_progress")
      .select("nugget_id, status")
      .eq("user_id", dbUser.id)
      .in("nugget_id", nuggetIds);
    for (const p of progress ?? []) {
      progressMap[p.nugget_id] = p.status;
    }
  }

  // Fetch user stats
  const { data: allProgress } = await service
    .from("microlearning_progress")
    .select("status")
    .eq("user_id", dbUser.id);

  const stats = {
    completed: (allProgress ?? []).filter((p) => p.status === "completed").length,
    bookmarked: (allProgress ?? []).filter((p) => p.status === "bookmarked").length,
    viewed: (allProgress ?? []).filter((p) => p.status === "viewed").length,
  };

  const initialNuggets = (nuggets ?? []).map((n) => ({
    ...n,
    user_status: progressMap[n.id] || null,
  }));

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Microlearning</h1>
        <p className="text-gray-500 mt-1">Daily bite-sized learning to sharpen your skills</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.completed}</p>
              <p className="text-xs text-gray-500">Completed</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-amber-600" fill="currentColor" viewBox="0 0 24 24">
                <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.bookmarked}</p>
              <p className="text-xs text-gray-500">Bookmarked</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.viewed}</p>
              <p className="text-xs text-gray-500">Viewed</p>
            </div>
          </div>
        </div>
      </div>

      {/* Daily Feed */}
      <DailyFeed initialNuggets={initialNuggets} />
    </div>
  );
}
