import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { checkAndAwardBadges, awardPoints } from "@/lib/gamification/awards";
import { dispatchWebhook } from "@/lib/webhooks/dispatcher";

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();

  const { data: authUser } = await supabase.auth.getUser();
  if (!authUser.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("users")
    .select("id")
    .eq("auth_id", authUser.user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "User profile not found" }, { status: 404 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { enrollment_id, lesson_id, status, add_time_spent } = body;

  if (!enrollment_id) {
    return NextResponse.json({ error: "enrollment_id is required" }, { status: 400 });
  }

  // Verify the enrollment belongs to this user
  const { data: enrollment } = await supabase
    .from("enrollments")
    .select("id, user_id, course_id, status, time_spent")
    .eq("id", enrollment_id)
    .single();

  if (!enrollment || enrollment.user_id !== profile.id) {
    return NextResponse.json({ error: "Enrollment not found" }, { status: 404 });
  }

  // Update time_spent on enrollment if requested
  if (add_time_spent && add_time_spent > 0) {
    const newTimeSpent = (enrollment.time_spent ?? 0) + add_time_spent;
    await supabase
      .from("enrollments")
      .update({ time_spent: newTimeSpent })
      .eq("id", enrollment_id);
  }

  // Update lesson progress if lesson_id and status are provided
  if (lesson_id && status) {
    const progressData: Record<string, unknown> = {
      user_id: profile.id,
      enrollment_id,
      lesson_id,
      status,
    };

    if (status === "completed") {
      progressData.completed_at = new Date().toISOString();
    }

    // Upsert: insert or update lesson_progress
    const { error } = await supabase
      .from("lesson_progress")
      .upsert(progressData, {
        onConflict: "enrollment_id,lesson_id",
      });

    if (error) {
      // If upsert with onConflict fails, try a select-then-update approach
      const { data: existing } = await supabase
        .from("lesson_progress")
        .select("id, status")
        .eq("enrollment_id", enrollment_id)
        .eq("lesson_id", lesson_id)
        .single();

      if (existing) {
        // Don't downgrade completed -> in_progress
        if (existing.status === "completed" && status !== "completed") {
          return NextResponse.json({ ok: true, skipped: true });
        }
        const updateData: Record<string, unknown> = { status };
        if (status === "completed") {
          updateData.completed_at = new Date().toISOString();
        }
        const { error: updateError } = await supabase
          .from("lesson_progress")
          .update(updateData)
          .eq("id", existing.id);

        if (updateError) {
          console.error("Progress update error:", updateError.message);
          return NextResponse.json({ error: "An internal error occurred" }, { status: 500 });
        }
      } else {
        // Insert fresh
        const { error: insertError } = await supabase
          .from("lesson_progress")
          .insert(progressData);

        if (insertError) {
          console.error("Progress insert error:", insertError.message);
          return NextResponse.json({ error: "An internal error occurred" }, { status: 500 });
        }
      }
    }
  }

  // ---- Gamification: award points and check badges ----
  let newBadges: unknown[] = [];
  let courseCompleted = false;

  if (lesson_id && status === "completed") {
    try {
      // Award points for completing a lesson
      await awardPoints(
        supabase,
        profile.id,
        10,
        "lesson_completion",
        "lesson",
        lesson_id
      );

      // Check if the user has earned any new badges
      newBadges = await checkAndAwardBadges(supabase, profile.id);
    } catch {
      // Gamification errors should not block the progress update
    }

    // ---- Check if all lessons are now completed (course completion flow) ----
    if (enrollment && enrollment.status !== "completed") {
      // Count total lessons vs completed lessons for this course
      const { data: modules } = await supabase
        .from("modules")
        .select("id")
        .eq("course_id", enrollment.course_id);

      const moduleIds = (modules || []).map((m: { id: string }) => m.id);

      if (moduleIds.length > 0) {
        const { count: totalLessons } = await supabase
          .from("lessons")
          .select("id", { count: "exact", head: true })
          .in("module_id", moduleIds);

        const { count: completedLessons } = await supabase
          .from("lesson_progress")
          .select("id", { count: "exact", head: true })
          .eq("enrollment_id", enrollment_id)
          .eq("status", "completed");

        // If all lessons are completed, mark enrollment as completed
        if (totalLessons && completedLessons && completedLessons >= totalLessons) {
          courseCompleted = true;

          await supabase
            .from("enrollments")
            .update({
              status: "completed",
              completed_at: new Date().toISOString(),
              certificate_issued: true,
            })
            .eq("id", enrollment_id);

          // Check if course has an associated certification and create user_certification
          const { data: certification } = await supabase
            .from("certifications")
            .select("id")
            .eq("course_id", enrollment.course_id)
            .eq("status", "active")
            .single();

          if (certification) {
            try {
              await supabase
                .from("user_certifications")
                .insert({
                  user_id: profile.id,
                  certification_id: certification.id,
                  issued_at: new Date().toISOString(),
                  expires_at: null,
                });
            } catch {
              // Ignore duplicate certification
            }
          }

          // Award bonus points for course completion
          try {
            await awardPoints(
              supabase,
              profile.id,
              50,
              "course_completion",
              "enrollment",
              enrollment_id
            );
            newBadges = await checkAndAwardBadges(supabase, profile.id);
          } catch {
            // Gamification errors should not block completion
          }

          // Fire enrollment.completed webhook (non-blocking)
          dispatchWebhook("enrollment.completed", {
            enrollment_id,
            user_id: profile.id,
            course_id: enrollment.course_id,
          }).catch(() => {});
        }
      }
    }

    return NextResponse.json({ ok: true, newBadges, courseCompleted });
  }

  return NextResponse.json({ ok: true });
}

// Support sendBeacon (which sends POST)
export async function POST(request: NextRequest) {
  return PATCH(request);
}
