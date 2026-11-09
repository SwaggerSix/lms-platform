import type { SupabaseClient } from "@supabase/supabase-js";

// Store bundles: a storefront product whose `learning_path_id` is set sells a
// whole learning path. Buying it enrolls the buyer in the path and in every
// course on it. Single-course products keep using `course_id`.
//
// Courses the buyer already has are left alone (upsert with ignoreDuplicates):
// no proration, the rest are simply added. Everything here is idempotent, so a
// retried Stripe delivery cannot double-enroll.

export interface BundlePathSummary {
  id: string;
  title: string;
  status: string;
  courses: { id: string; title: string }[];
}

/** Order line as fulfilment sees it (order_items row). */
export interface FulfilmentItem {
  course_id: string | null;
  learning_path_id?: string | null;
}

/**
 * Why a learning path can't be sold as a bundle, or null when it can.
 * Archived paths and paths with no courses would take money and enroll the
 * buyer in nothing.
 */
export function bundlePathProblem(path: BundlePathSummary | null): string | null {
  if (!path) return "That learning path no longer exists.";
  if (path.status === "archived") {
    return `The learning path "${path.title}" is archived. Pick another path, or restore it first.`;
  }
  if (path.courses.length === 0) {
    return `The learning path "${path.title}" has no courses yet. Add its courses under Admin → Learning Paths first.`;
  }
  return null;
}

/** A learning path with its courses in path order, or null if missing. */
export async function loadBundlePath(
  service: SupabaseClient,
  pathId: string
): Promise<BundlePathSummary | null> {
  const { data, error } = await service
    .from("learning_paths")
    .select("id, title, status, items:learning_path_items(sequence_order, course:courses(id, title))")
    .eq("id", pathId)
    .maybeSingle();
  if (error || !data) return null;
  return toSummary(data as RawPath);
}

/** Every non-archived learning path, for the admin's bundle picker. */
export async function listBundlePaths(service: SupabaseClient): Promise<BundlePathSummary[]> {
  const { data } = await service
    .from("learning_paths")
    .select("id, title, status, items:learning_path_items(sequence_order, course:courses(id, title))")
    .neq("status", "archived")
    .order("title")
    .limit(500);
  return ((data as RawPath[] | null) || []).map(toSummary);
}

interface RawPath {
  id: string;
  title: string;
  status: string;
  items?: { sequence_order: number; course: { id: string; title: string } | { id: string; title: string }[] | null }[] | null;
}

function toSummary(p: RawPath): BundlePathSummary {
  const courses = [...(p.items || [])]
    .sort((a, b) => a.sequence_order - b.sequence_order)
    .map((i) => (Array.isArray(i.course) ? i.course[0] : i.course))
    .filter((c): c is { id: string; title: string } => Boolean(c));
  return { id: p.id, title: p.title, status: p.status, courses };
}

/**
 * The courses and learning paths an order entitles its buyer to. Bundle lines
 * are expanded to the path's courses as they stand at fulfilment. Duplicates
 * (a course bought alone AND inside a bundle) collapse to one.
 */
export async function resolveOrderEntitlements(
  service: SupabaseClient,
  items: FulfilmentItem[]
): Promise<{ courseIds: string[]; pathIds: string[] }> {
  const courseIds = new Set<string>();
  const pathIds = new Set<string>();
  for (const item of items) {
    if (item.course_id) courseIds.add(item.course_id);
    if (item.learning_path_id) pathIds.add(item.learning_path_id);
  }
  if (pathIds.size > 0) {
    const { data: pathItems, error } = await service
      .from("learning_path_items")
      .select("path_id, course_id, sequence_order")
      .in("path_id", [...pathIds])
      .order("sequence_order", { ascending: true });
    if (error) {
      console.error("Storefront bundle: could not read path courses:", error.message);
    }
    for (const pi of (pathItems as { course_id: string }[] | null) || []) {
      if (pi.course_id) courseIds.add(pi.course_id);
    }
  }
  return { courseIds: [...courseIds], pathIds: [...pathIds] };
}

/**
 * Enrolls a user in the given courses and learning paths. Already-held
 * enrollments are untouched (ignoreDuplicates), so this is safe to repeat.
 */
export async function enrollInEntitlements(
  service: SupabaseClient,
  userId: string,
  entitlements: { courseIds: string[]; pathIds: string[] },
  storefrontId: string | null,
  now: string = new Date().toISOString()
): Promise<void> {
  if (entitlements.courseIds.length > 0) {
    const { error } = await service.from("enrollments").upsert(
      entitlements.courseIds.map((courseId) => ({
        user_id: userId,
        course_id: courseId,
        // enrollments_status_check allows enrolled|in_progress|completed|
        // failed|expired. Store fulfilment used to write "active", which the
        // database rejects, so paid store orders never actually enrolled.
        status: "enrolled",
        enrolled_at: now,
        storefront_id: storefrontId,
      })),
      { onConflict: "user_id,course_id", ignoreDuplicates: true }
    );
    if (error) console.error("Storefront: course enrollment failed:", error.message);
  }
  if (entitlements.pathIds.length > 0) {
    const { error } = await service.from("learning_path_enrollments").upsert(
      entitlements.pathIds.map((pathId) => ({
        user_id: userId,
        path_id: pathId,
        status: "enrolled",
        enrolled_at: now,
      })),
      { onConflict: "user_id,path_id", ignoreDuplicates: true }
    );
    if (error) console.error("Storefront: learning path enrollment failed:", error.message);
  }
}
