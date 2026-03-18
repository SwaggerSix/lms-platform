import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import PathsClient, { pickGradient } from "./paths-client";
import type { LearningPath } from "./paths-client";

export const metadata: Metadata = {
  title: "Learning Paths | LMS Platform",
  description: "Explore structured learning paths to build skills step by step",
};

export default async function LearningPathsPage() {
  const supabase = await createClient();

  // Get authenticated user
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    redirect("/login");
  }

  // Fetch user profile from users table
  const service = createServiceClient();
  const { data: profile } = await service
    .from("users")
    .select("id")
    .eq("auth_id", authUser.id)
    .single();

  if (!profile) {
    redirect("/login");
  }

  // Fetch published learning paths with item counts
  const { data: rawPaths } = await service
    .from("learning_paths")
    .select(
      "id, slug, title, description, estimated_duration, tags, learning_path_items(id, course_id)"
    )
    .eq("status", "published")
    .order("created_at", { ascending: false });

  // Fetch user's enrollments for learning paths
  const { data: enrollments } = await service
    .from("learning_path_enrollments")
    .select("path_id, status")
    .eq("user_id", profile.id);

  // Build a map of path_id -> enrollment status for quick lookups
  const enrollmentMap = new Map<string, string>();
  if (enrollments) {
    for (const e of enrollments) {
      enrollmentMap.set(e.path_id, e.status);
    }
  }

  // Compute progress per enrolled path based on completed course enrollments
  // Gather all course_ids per path so we can query completion
  const pathCourseMap = new Map<string, string[]>();
  if (rawPaths) {
    for (const rp of rawPaths) {
      const items = (rp as any).learning_path_items as any[];
      if (items && items.length > 0) {
        pathCourseMap.set(
          rp.id,
          items.map((i: any) => i.course_id)
        );
      }
    }
  }

  // Fetch completed course enrollments for the user to calculate progress
  const allCourseIds = Array.from(pathCourseMap.values()).flat();
  let completedCourseIds = new Set<string>();

  if (allCourseIds.length > 0) {
    const { data: completedEnrollments } = await service
      .from("enrollments")
      .select("course_id")
      .eq("user_id", profile.id)
      .eq("status", "completed")
      .in("course_id", allCourseIds);

    if (completedEnrollments) {
      completedCourseIds = new Set(completedEnrollments.map((e: any) => e.course_id));
    }
  }

  // Shape the data to match the client interface
  const paths: LearningPath[] = (rawPaths ?? []).map((rp, index) => {
    const items = (rp as any).learning_path_items as any[];
    const courseCount = items ? items.length : 0;
    const courseIds = pathCourseMap.get(rp.id) ?? [];
    const enrollmentStatus = enrollmentMap.get(rp.id);
    const enrolled = !!enrollmentStatus;

    // Calculate progress as percentage of completed courses in the path
    let progress: number | null = null;
    if (enrolled && courseCount > 0) {
      const completedCount = courseIds.filter((cid) => completedCourseIds.has(cid)).length;
      progress = Math.round((completedCount / courseCount) * 100);
    }

    return {
      id: rp.id,
      slug: rp.slug,
      title: rp.title,
      description: rp.description ?? "",
      courseCount,
      totalDuration: rp.estimated_duration ?? 0,
      skills: rp.tags ?? [],
      progress,
      enrolled,
      gradient: pickGradient(index),
    };
  });

  return <PathsClient paths={paths} />;
}
