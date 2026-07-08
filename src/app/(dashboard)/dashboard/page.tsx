import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import LearnerDashboardClient from "./dashboard-client";
import type { LearnerDashboardData } from "./dashboard-client";

export const metadata: Metadata = {
  title: "Dashboard | LMS Platform",
  description: "View your learning progress, upcoming deadlines, and course recommendations",
};

const GRADIENT_THUMBNAILS = [
  "bg-gradient-to-br from-blue-500 to-primary-600",
  "bg-gradient-to-br from-red-500 to-pink-600",
  "bg-gradient-to-br from-emerald-500 to-teal-600",
  "bg-gradient-to-br from-violet-500 to-purple-600",
  "bg-gradient-to-br from-amber-500 to-orange-600",
  "bg-gradient-to-br from-cyan-500 to-blue-600",
];

const SPOTLIGHT_GRADIENTS = [
  "bg-gradient-to-br from-blue-600 to-primary-700",
  "bg-gradient-to-br from-emerald-500 to-teal-600",
  "bg-gradient-to-br from-red-500 to-rose-600",
];

const COURSE_TYPE_LABELS: Record<string, string> = {
  self_paced: "Self-Paced",
  instructor_led: "Instructor-Led",
  blended: "Blended",
  scorm: "SCORM",
  external: "External",
};

// A course counts as "New" in the spotlight if it was published this recently.
const NEW_BADGE_WINDOW_DAYS = 45;

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0 && mins > 0) return `${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h`;
  return `${mins}m`;
}

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Use service client to bypass RLS (avoids infinite recursion in users policy)
  const service = createServiceClient();
  let { data: dbUser } = await service
    .from("users")
    .select("id, first_name, role")
    .eq("auth_id", user.id)
    .single();

  // Auto-provision a profile if it's missing (e.g. registration API failed
  // mid-signup, or the row exists under a different auth_id because the email
  // was previously invited/imported). Without this, redirecting to /login
  // loops with middleware which sends authenticated users on /login back
  // to /dashboard.
  if (!dbUser && user.email) {
    // Look for an existing row with the same email — invited/imported users
    // often have an email row created before they ever signed up with Supabase
    // Auth, so their auth_id will be NULL or a stale value.
    const { data: byEmail } = await service
      .from("users")
      .select("id, first_name, role, auth_id")
      .eq("email", user.email)
      .maybeSingle();

    if (byEmail) {
      const { data: linked, error: linkErr } = await service
        .from("users")
        .update({ auth_id: user.id })
        .eq("id", byEmail.id)
        .select("id, first_name, role")
        .single();
      if (linkErr) console.error("[dashboard] link error", linkErr);
      dbUser = linked ?? { id: byEmail.id, first_name: byEmail.first_name, role: byEmail.role };
    } else {
      const meta = (user.user_metadata ?? {}) as {
        first_name?: string;
        last_name?: string;
      };
      const { data: created, error: insertErr } = await service
        .from("users")
        .insert({
          auth_id: user.id,
          email: user.email,
          first_name: meta.first_name?.trim() || "New",
          last_name: meta.last_name?.trim() || "User",
          role: "learner",
          status: "active",
        })
        .select("id, first_name, role")
        .single();
      if (insertErr) console.error("[dashboard] insert error", insertErr);
      dbUser = created;
    }
  }

  if (!dbUser) {
    console.error("[dashboard] dbUser still null after auto-provision; refusing to redirect-loop.");
    // Don't redirect to /login — middleware will bounce back and loop.
    // Render a minimal fallback so the user sees something instead of a blank.
    return (
      <div className="mx-auto max-w-2xl p-8 text-center">
        <h1 className="text-2xl font-bold text-gray-900">We couldn&apos;t load your profile</h1>
        <p className="mt-2 text-gray-600">
          Your account is signed in but we couldn&apos;t find or create a learner
          profile. Please contact support and mention this email: {user.email}.
        </p>
      </div>
    );
  }

  // Admins land on the platform-overview dashboard rather than the learner view.
  if (dbUser.role === "admin" || dbUser.role === "super_admin") {
    redirect("/admin/dashboard");
  }

  const userName = dbUser.first_name ?? "Learner";
  const userId = dbUser.id;

  // Run all counts and queries in parallel. Each is wrapped so one failing
  // query can't blank the whole dashboard for a user — the page must always
  // render something (even if just the welcome banner and zeroed stats).
  type QueryResult = { data: unknown[] | null; count: number | null };
  const safe = async (
    label: string,
    p: PromiseLike<{ data: unknown; count?: number | null }>
  ): Promise<QueryResult> => {
    try {
      const { data, count } = await p;
      return {
        data: Array.isArray(data) ? (data as unknown[]) : null,
        count: count ?? null,
      };
    } catch (err) {
      console.error(`[dashboard] query failed: ${label}`, err);
      return { data: null, count: null };
    }
  };

  const [
    inProgressCountResult,
    completedCountResult,
    certsCountResult,
    deadlinesCountResult,
    inProgressCoursesResult,
    deadlinesResult,
    spotlightResult,
    recentBadgesResult,
  ] = await Promise.all([
    safe(
      "inProgressCount",
      service
        .from("enrollments")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("status", "in_progress")
    ),

    safe(
      "completedCount",
      service
        .from("enrollments")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("status", "completed")
    ),

    safe(
      "certsCount",
      service
        .from("user_certifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
    ),

    safe(
      "deadlinesCount",
      service
        .from("enrollments")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .not("due_date", "is", null)
        .gte("due_date", new Date().toISOString())
    ),

    safe(
      "inProgressCourses",
      service
        .from("enrollments")
        .select(`
          id,
          time_spent,
          course:courses (
            id,
            title,
            estimated_duration,
            category:categories ( name ),
            instructor:users!courses_created_by_fkey ( first_name, last_name )
          )
        `)
        .eq("user_id", userId)
        .eq("status", "in_progress")
        .limit(3)
    ),

    safe(
      "deadlines",
      service
        .from("enrollments")
        .select(`
          id,
          due_date,
          course:courses (
            title,
            course_type
          )
        `)
        .eq("user_id", userId)
        .not("due_date", "is", null)
        .gte("due_date", new Date().toISOString())
        .order("due_date", { ascending: true })
        .limit(4)
    ),

    safe(
      "spotlight",
      service
        .from("courses")
        .select(`
          id,
          title,
          slug,
          description,
          estimated_duration,
          course_type,
          created_by,
          published_at,
          metadata,
          instructor:users!courses_created_by_fkey ( first_name, last_name )
        `)
        .eq("status", "published")
        .order("published_at", { ascending: false })
        .limit(3)
    ),

    safe(
      "recentBadges",
      service
        .from("user_badges")
        .select(`
          awarded_at,
          badge:badges ( id, name, description )
        `)
        .eq("user_id", userId)
        .order("awarded_at", { ascending: false })
        .limit(3)
    ),
  ]);

  const coursesInProgress = inProgressCountResult.count ?? 0;
  const coursesCompleted = completedCountResult.count ?? 0;
  const certificatesEarned = certsCountResult.count ?? 0;
  const upcomingDeadlinesCount = deadlinesCountResult.count ?? 0;

  // Real enrollment counts for the spotlight courses (never fabricate numbers).
  const spotlightIds = (spotlightResult.data ?? []).map((c: any) => c.id);
  const enrolledCounts: Record<string, number> = {};
  if (spotlightIds.length > 0) {
    const { data: spotlightEnrollments } = await service
      .from("enrollments")
      .select("course_id")
      .in("course_id", spotlightIds);
    for (const row of spotlightEnrollments ?? []) {
      enrolledCounts[row.course_id] = (enrolledCounts[row.course_id] ?? 0) + 1;
    }
  }

  // Map in-progress courses
  const inProgressCourses: LearnerDashboardData["inProgressCourses"] = (
    inProgressCoursesResult.data ?? []
  ).map((enrollment: any, index: number) => {
    const course = enrollment.course;
    const estimatedDuration = course?.estimated_duration ?? 60;
    const timeSpent = enrollment.time_spent ?? 0;
    const progress = Math.min(
      100,
      Math.round((timeSpent / estimatedDuration) * 100)
    );

    return {
      id: enrollment.id,
      courseId: course?.id ?? "",
      title: course?.title ?? "Untitled Course",
      instructor: course?.instructor
        ? `${course.instructor.first_name} ${course.instructor.last_name}`
        : null,
      thumbnail: GRADIENT_THUMBNAILS[index % GRADIENT_THUMBNAILS.length],
      progress,
      category: course?.category?.name ?? "General",
    };
  });

  // Map upcoming deadlines
  const upcomingDeadlines: LearnerDashboardData["upcomingDeadlines"] = (
    deadlinesResult.data ?? []
  ).map((enrollment: any) => {
    const dueDate = new Date(enrollment.due_date);
    const now = new Date();
    const daysLeft = Math.ceil(
      (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );
    const courseType = enrollment.course?.course_type ?? "self_paced";

    let status: string;
    if (daysLeft <= 5) status = "urgent";
    else if (daysLeft <= 14) status = "upcoming";
    else status = "normal";

    return {
      id: enrollment.id,
      course: enrollment.course?.title ?? "Untitled Course",
      type: COURSE_TYPE_LABELS[courseType] ?? courseType,
      dueDate: dueDate.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
      daysLeft,
      status,
    };
  });

  // Map spotlight courses
  const newBadgeCutoff = Date.now() - NEW_BADGE_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const spotlightCourses: LearnerDashboardData["spotlightCourses"] = (
    spotlightResult.data ?? []
  ).map((course: any, index: number) => {
    // Only show a rating when the course actually has reviews — never fabricate
    // one for newly created/never-deployed courses.
    const meta = course.metadata || {};
    const reviewCount = meta.review_count ?? meta.reviewCount ?? 0;
    const rating = reviewCount > 0 ? Math.round((meta.rating ?? 0) * 10) / 10 : 0;
    const instructor = course.instructor
      ? `${course.instructor.first_name} ${course.instructor.last_name}`
      : null;
    const isNew =
      course.published_at && new Date(course.published_at).getTime() >= newBadgeCutoff;

    return {
      id: course.id,
      title: course.title ?? "Untitled Course",
      slug: course.slug ?? "",
      description: course.description ?? "",
      thumbnail: SPOTLIGHT_GRADIENTS[index % SPOTLIGHT_GRADIENTS.length],
      instructor,
      enrolled: enrolledCounts[course.id] ?? 0,
      rating,
      duration: formatDuration(course.estimated_duration ?? 60),
      type: COURSE_TYPE_LABELS[course.course_type] ?? course.course_type,
      badge: isNew ? "New" : null,
    };
  });

  // Map the learner's most recently earned badges
  const recentAchievements: LearnerDashboardData["recentAchievements"] = (
    recentBadgesResult.data ?? []
  )
    .filter((row: any) => row.badge)
    .map((row: any) => ({
      id: row.badge.id,
      title: row.badge.name,
      description: row.badge.description ?? "",
      awardedAt: row.awarded_at,
    }));

  const dashboardData: LearnerDashboardData = {
    userName,
    coursesInProgress,
    coursesCompleted,
    certificatesEarned,
    upcomingDeadlinesCount,
    inProgressCourses,
    upcomingDeadlines,
    spotlightCourses,
    recentAchievements,
  };

  return <LearnerDashboardClient data={dashboardData} />;
}
