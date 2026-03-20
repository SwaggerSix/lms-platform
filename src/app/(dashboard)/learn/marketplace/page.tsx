import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import UnifiedCatalog from "@/components/marketplace/unified-catalog";

export const metadata: Metadata = {
  title: "Course Marketplace | LMS Platform",
  description: "Browse internal and external courses from top providers",
};

export default async function LearnMarketplacePage() {
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

  // Fetch internal courses
  const { data: internalCourses } = await service
    .from("courses")
    .select("id, title, description, thumbnail_url, difficulty_level, estimated_duration, slug")
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(20);

  // Fetch external marketplace courses
  const { data: externalCourses } = await service
    .from("marketplace_courses")
    .select("*, provider:marketplace_providers(id, name, provider_type)")
    .eq("is_active", true)
    .order("rating", { ascending: false, nullsFirst: false })
    .limit(20);

  // Fetch user's marketplace enrollments
  const externalIds = (externalCourses ?? []).map((c) => c.id);
  let enrollmentMap: Record<string, { status: string; progress: number }> = {};

  if (externalIds.length > 0) {
    const { data: enrollments } = await service
      .from("marketplace_enrollments")
      .select("marketplace_course_id, status, progress")
      .eq("user_id", dbUser.id)
      .in("marketplace_course_id", externalIds);

    for (const e of enrollments ?? []) {
      enrollmentMap[e.marketplace_course_id] = {
        status: e.status,
        progress: Number(e.progress),
      };
    }
  }

  const mappedExternal = (externalCourses ?? []).map((c) => ({
    ...c,
    user_enrollment: enrollmentMap[c.id] || null,
  }));

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Course Marketplace</h1>
        <p className="text-gray-500 mt-1">
          Browse courses from internal catalog and external providers
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
            <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342" />
            </svg>
          </div>
          <div>
            <p className="text-xl font-bold text-gray-900">{internalCourses?.length || 0}</p>
            <p className="text-xs text-gray-500">Internal Courses</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
            <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
            </svg>
          </div>
          <div>
            <p className="text-xl font-bold text-gray-900">{externalCourses?.length || 0}</p>
            <p className="text-xs text-gray-500">External Courses</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
            <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="text-xl font-bold text-gray-900">
              {Object.values(enrollmentMap).filter((e) => e.status === "completed").length}
            </p>
            <p className="text-xs text-gray-500">Completed</p>
          </div>
        </div>
      </div>

      <UnifiedCatalog
        initialCourses={mappedExternal}
        internalCourses={internalCourses ?? []}
      />
    </div>
  );
}
