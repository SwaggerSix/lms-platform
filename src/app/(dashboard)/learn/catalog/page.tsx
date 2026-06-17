import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import CatalogClient, { type CatalogCourse } from "./catalog-client";

export const metadata: Metadata = {
  title: "Course Catalog | LMS Platform",
  description: "Browse and enroll in courses across all categories and skill levels",
};

const GRADIENTS = [
  "from-blue-500 to-indigo-600",
  "from-amber-500 to-orange-600",
  "from-red-500 to-rose-600",
  "from-green-500 to-emerald-600",
  "from-purple-500 to-violet-600",
  "from-cyan-500 to-blue-600",
  "from-slate-600 to-gray-800",
  "from-pink-500 to-rose-600",
  "from-emerald-500 to-teal-600",
  "from-indigo-500 to-purple-600",
  "from-yellow-500 to-amber-600",
  "from-sky-500 to-blue-600",
];

function mapDifficulty(level: string): "Beginner" | "Intermediate" | "Advanced" {
  const map: Record<string, "Beginner" | "Intermediate" | "Advanced"> = {
    beginner: "Beginner",
    intermediate: "Intermediate",
    advanced: "Advanced",
  };
  return map[level?.toLowerCase()] ?? "Beginner";
}

function mapCourseType(type: string): "Video" | "Interactive" | "Document" | "Blended" {
  const map: Record<string, "Video" | "Interactive" | "Document" | "Blended"> = {
    self_paced: "Video",
    instructor_led: "Interactive",
    blended: "Blended",
    scorm: "Document",
    external: "Document",
  };
  return map[type] ?? "Video";
}

function mapCategory(categoryName: string | null): string {
  if (!categoryName) return "Technology";
  const lower = categoryName.toLowerCase();
  if (lower.includes("tech") || lower.includes("data") || lower.includes("cloud") || lower.includes("cyber")) return "Technology";
  if (lower.includes("leader") || lower.includes("manage")) return "Leadership";
  if (lower.includes("business") || lower.includes("finance") || lower.includes("project")) return "Business";
  if (lower.includes("compliance") || lower.includes("safety") || lower.includes("regulation")) return "Compliance";
  if (lower.includes("soft") || lower.includes("communication")) return "Soft Skills";
  return "Technology";
}

export default async function CourseCatalogPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const service = createServiceClient();
  let { data: dbUser } = await service
    .from("users")
    .select("id")
    .eq("auth_id", user.id)
    .single();

  // Auto-provision a profile if missing — try by auth_id first, then by email
  // (for invited/imported users), then insert. Mirrors /dashboard.
  if (!dbUser && user.email) {
    const { data: byEmail } = await service
      .from("users")
      .select("id, auth_id")
      .eq("email", user.email)
      .maybeSingle();

    if (byEmail) {
      const { data: linked } = await service
        .from("users")
        .update({ auth_id: user.id })
        .eq("id", byEmail.id)
        .select("id")
        .single();
      dbUser = linked ?? { id: byEmail.id };
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
        .select("id")
        .single();
      if (insertErr) console.error("[catalog] insert error", insertErr);
      dbUser = created;
    }
  }

  if (!dbUser) {
    console.error("[catalog] dbUser null; refusing to redirect-loop. Auth user:", user.id, user.email);
    return (
      <div className="mx-auto max-w-2xl p-8 text-center">
        <h1 className="text-2xl font-bold text-gray-900">We couldn&apos;t load your profile</h1>
        <p className="mt-2 text-gray-600">
          Please contact support and mention this email: {user.email}.
        </p>
      </div>
    );
  }

  // Don't let one failing query blank the catalog. Log and return empty.
  const safe = async (
    label: string,
    p: PromiseLike<{ data: unknown }>
  ): Promise<unknown[] | null> => {
    try {
      const { data } = await p;
      return Array.isArray(data) ? (data as unknown[]) : null;
    } catch (err) {
      console.error(`[catalog] query failed: ${label}`, err);
      return null;
    }
  };

  type DbCourse = {
    id: string;
    slug: string;
    title: string;
    description: string | null;
    short_description: string | null;
    difficulty_level: string;
    course_type: string;
    estimated_duration: number | null;
    enrollment_type: string;
    created_at: string;
    thumbnail_url: string | null;
    category: { name: string } | null;
  };
  type Prereq = { course_id: string; prerequisite_course_id: string; requirement_type: string; min_score: number | null };
  type Enrollment = { course_id: string; status: string; score: number | null };

  const nowIso = new Date().toISOString();
  const dbCourses = (await safe(
    "courses",
    service
      .from("courses")
      .select("*, category:categories(name)")
      .eq("status", "published")
      // Only courses currently within their availability window (NULL = unbounded).
      .or(`available_from.is.null,available_from.lte.${nowIso}`)
      .or(`available_until.is.null,available_until.gte.${nowIso}`)
      .order("created_at", { ascending: false })
      .limit(50)
  )) as DbCourse[] | null;

  const courseIds = (dbCourses ?? []).map((c) => c.id);
  const allPrereqs = courseIds.length > 0
    ? ((await safe(
        "prereqs",
        service
          .from("course_prerequisites")
          .select("course_id, prerequisite_course_id, requirement_type, min_score")
          .in("course_id", courseIds)
      )) as Prereq[] | null)
    : [];

  const userEnrollments = (await safe(
    "userEnrollments",
    service
      .from("enrollments")
      .select("course_id, status, score")
      .eq("user_id", dbUser.id)
  )) as Enrollment[] | null;

  const enrollmentMap = new Map(
    (userEnrollments ?? []).map((e) => [e.course_id, e])
  );

  const prereqsByCourse = new Map<string, Prereq[]>();
  for (const prereq of allPrereqs ?? []) {
    const list = prereqsByCourse.get(prereq.course_id) ?? [];
    list.push(prereq);
    prereqsByCourse.set(prereq.course_id, list);
  }

  const courses: CatalogCourse[] = (dbCourses ?? []).map((c, i) => {
    const coursePrereqs = prereqsByCourse.get(c.id) || [];
    let hasUnmetPrerequisites = false;

    for (const prereq of coursePrereqs) {
      const enrollment = enrollmentMap.get(prereq.prerequisite_course_id);
      if (prereq.requirement_type === "enrollment") {
        if (!enrollment || enrollment.status === "dropped") {
          hasUnmetPrerequisites = true;
          break;
        }
      } else if (prereq.requirement_type === "completion") {
        if (!enrollment || enrollment.status !== "completed") {
          hasUnmetPrerequisites = true;
          break;
        }
      } else if (prereq.requirement_type === "min_score") {
        if (
          !enrollment ||
          enrollment.status !== "completed" ||
          (enrollment.score ?? 0) < (prereq.min_score ?? 0)
        ) {
          hasUnmetPrerequisites = true;
          break;
        }
      }
    }

    return {
      id: c.id,
      slug: c.slug,
      title: c.title,
      description: c.description || c.short_description || "",
      instructor: "Instructor",
      difficulty: mapDifficulty(c.difficulty_level),
      type: mapCourseType(c.course_type),
      duration: c.estimated_duration || 60,
      rating: 4.5 + (((i * 7) % 5) / 10),
      reviewCount: 100 + ((i * 37) % 400),
      enrolledCount: 500 + ((i * 137) % 5000),
      category: mapCategory(c.category?.name ?? null),
      gradient: GRADIENTS[i % GRADIENTS.length],
      thumbnailUrl: c.thumbnail_url ?? null,
      createdAt: c.created_at,
      hasUnmetPrerequisites,
      requiresApproval: c.enrollment_type === "approval",
    };
  });

  return <CatalogClient courses={courses} />;
}
