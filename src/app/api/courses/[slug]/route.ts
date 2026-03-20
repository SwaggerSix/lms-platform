import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { trackLearningEvent } from "@/lib/ai/track-event";

/**
 * Compute drip availability for each module based on drip_type,
 * the user's enrollment date, and previous module completion status.
 */
function computeDripAvailability(
  modules: any[],
  enrolledAt: string | null,
  completedModuleIds: Set<string>
) {
  // Sort modules by sequence_order for correct "after_previous" logic
  const sorted = [...modules].sort(
    (a, b) => (a.sequence_order ?? 0) - (b.sequence_order ?? 0)
  );

  return sorted.map((mod, index) => {
    const dripType = mod.drip_type || "immediate";
    let isAvailable = true;
    let availableDate: string | null = null;

    switch (dripType) {
      case "immediate":
        isAvailable = true;
        break;

      case "after_days": {
        if (!enrolledAt) {
          // Not enrolled yet — not available
          isAvailable = false;
          break;
        }
        const enrollDate = new Date(enrolledAt);
        const unlockDate = new Date(enrollDate);
        unlockDate.setDate(unlockDate.getDate() + (mod.drip_days || 0));
        availableDate = unlockDate.toISOString();
        isAvailable = new Date() >= unlockDate;
        break;
      }

      case "on_date": {
        if (mod.drip_date) {
          const targetDate = new Date(mod.drip_date);
          availableDate = targetDate.toISOString();
          isAvailable = new Date() >= targetDate;
        }
        break;
      }

      case "after_previous": {
        if (index === 0) {
          // First module is always available
          isAvailable = true;
        } else {
          const prevModule = sorted[index - 1];
          isAvailable = completedModuleIds.has(prevModule.id);
        }
        break;
      }

      default:
        isAvailable = true;
    }

    return {
      ...mod,
      is_available: isAvailable,
      available_date: availableDate,
      drip_type: dripType,
    };
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const service = createServiceClient();

  // Check user role for status filtering
  const { data: profile } = await service.from("users").select("role, id").eq("auth_id", user.id).single();

  let query = service
    .from("courses")
    .select("*, category:categories(name), modules(*, lessons(*))")
    .eq("slug", slug);

  // Non-admin/instructor users can only see published courses
  if (!profile || !["admin", "instructor"].includes(profile.role)) {
    query = query.eq("status", "published");
  }

  const { data, error } = await query.single();

  if (error) {
    if (error.code === "PGRST116") {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }
    console.error("Courses API error:", error.message);
    return NextResponse.json({ error: "An internal error occurred" }, { status: 500 });
  }

  // Compute drip availability if user is a learner
  if (profile && data.modules && data.modules.length > 0) {
    // Get enrollment date for this course
    const { data: enrollment } = await service
      .from("enrollments")
      .select("id, enrolled_at")
      .eq("user_id", profile.id)
      .eq("course_id", data.id)
      .single();

    const enrolledAt = enrollment?.enrolled_at ?? null;

    // Determine which modules are fully completed (all lessons completed)
    const completedModuleIds = new Set<string>();

    if (enrollment) {
      // Get all lesson progress for this enrollment
      const allLessonIds = data.modules.flatMap((m: any) =>
        (m.lessons ?? []).map((l: any) => l.id)
      );

      if (allLessonIds.length > 0) {
        const { data: progressRows } = await service
          .from("lesson_progress")
          .select("lesson_id, status")
          .eq("user_id", profile.id)
          .eq("enrollment_id", enrollment.id)
          .in("lesson_id", allLessonIds);

        const completedLessonIds = new Set(
          (progressRows ?? [])
            .filter((p: any) => p.status === "completed")
            .map((p: any) => p.lesson_id)
        );

        // A module is "completed" if all its lessons are completed
        for (const mod of data.modules) {
          const moduleLessons = (mod as any).lessons ?? [];
          if (
            moduleLessons.length > 0 &&
            moduleLessons.every((l: any) => completedLessonIds.has(l.id))
          ) {
            completedModuleIds.add(mod.id);
          }
        }
      }
    }

    // Replace modules with drip-aware versions
    data.modules = computeDripAvailability(
      data.modules,
      enrolledAt,
      completedModuleIds
    );
  }

  // Track course view event (fire-and-forget)
  if (profile) {
    trackLearningEvent({
      userId: profile.id,
      eventType: "view_course",
      courseId: data.id,
      metadata: { slug },
    }).catch(() => {});
  }

  return NextResponse.json(data);
}
