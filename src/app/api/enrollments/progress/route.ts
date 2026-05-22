import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { NextRequest, NextResponse } from "next/server";
import { checkAndAwardBadges, awardPoints } from "@/lib/gamification/awards";
import { dispatchWebhook } from "@/lib/webhooks/dispatcher";
import { trackLearningEvent } from "@/lib/ai/track-event";
import { createEvaluationAssignments } from "@/lib/evaluations/create-assignments";
import { sendEmail } from "@/lib/email/sender";
import { courseCompletion } from "@/lib/email/templates";
import { userMaySend } from "@/lib/notifications/preferences";
import { jsonNoStore } from "@/lib/api/no-store";

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();

  const { data: authUser } = await supabase.auth.getUser();
  if (!authUser.user) {
    return jsonNoStore({ error: "Unauthorized" }, { status: 401 });
  }

  const service = createServiceClient();
  const { data: profile } = await service
    .from("users")
    .select("id, email, first_name, last_name, preferences")
    .eq("auth_id", authUser.user.id)
    .single();

  if (!profile) {
    return jsonNoStore({ error: "User profile not found" }, { status: 404 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonNoStore({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { enrollment_id, lesson_id, status, add_time_spent } = body;

  if (!enrollment_id) {
    return jsonNoStore({ error: "enrollment_id is required" }, { status: 400 });
  }

  // Verify the enrollment belongs to this user
  const { data: enrollment } = await service
    .from("enrollments")
    .select("id, user_id, course_id, status, time_spent")
    .eq("id", enrollment_id)
    .single();

  if (!enrollment || enrollment.user_id !== profile.id) {
    return jsonNoStore({ error: "Enrollment not found" }, { status: 404 });
  }

  // Update time_spent on enrollment if requested
  if (add_time_spent && add_time_spent > 0) {
    const newTimeSpent = (enrollment.time_spent ?? 0) + add_time_spent;
    await service
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
    const { error } = await service
      .from("lesson_progress")
      .upsert(progressData, {
        onConflict: "enrollment_id,lesson_id",
      });

    if (error) {
      // If upsert with onConflict fails, try a select-then-update approach
      const { data: existing } = await service
        .from("lesson_progress")
        .select("id, status")
        .eq("enrollment_id", enrollment_id)
        .eq("lesson_id", lesson_id)
        .single();

      if (existing) {
        // Don't downgrade completed -> in_progress
        if (existing.status === "completed" && status !== "completed") {
          return jsonNoStore({ ok: true, skipped: true });
        }
        const updateData: Record<string, unknown> = { status };
        if (status === "completed") {
          updateData.completed_at = new Date().toISOString();
        }
        const { error: updateError } = await service
          .from("lesson_progress")
          .update(updateData)
          .eq("id", existing.id);

        if (updateError) {
          console.error("Progress update error:", updateError.message);
          return jsonNoStore({ error: "An internal error occurred" }, { status: 500 });
        }
      } else {
        // Insert fresh
        const { error: insertError } = await service
          .from("lesson_progress")
          .insert(progressData);

        if (insertError) {
          console.error("Progress insert error:", insertError.message);
          return jsonNoStore({ error: "An internal error occurred" }, { status: 500 });
        }
      }
    }
  }

  // ---- Track learning events (fire-and-forget) ----
  if (lesson_id && status === "completed") {
    trackLearningEvent({
      userId: profile.id,
      eventType: "complete_lesson",
      courseId: enrollment.course_id,
      metadata: { lesson_id, enrollment_id },
    }).catch(() => {});
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
      const { data: modules } = await service
        .from("modules")
        .select("id")
        .eq("course_id", enrollment.course_id);

      const moduleIds = (modules || []).map((m: { id: string }) => m.id);

      if (moduleIds.length > 0) {
        const { count: totalLessons } = await service
          .from("lessons")
          .select("id", { count: "exact", head: true })
          .in("module_id", moduleIds);

        const { count: completedLessons } = await service
          .from("lesson_progress")
          .select("id", { count: "exact", head: true })
          .eq("enrollment_id", enrollment_id)
          .eq("status", "completed");

        // If all lessons are completed, mark enrollment as completed
        if (totalLessons && completedLessons && completedLessons >= totalLessons) {
          courseCompleted = true;

          await service
            .from("enrollments")
            .update({
              status: "completed",
              completed_at: new Date().toISOString(),
              certificate_issued: true,
            })
            .eq("id", enrollment_id);

          // Check if course has an associated certification and create user_certification
          const { data: certification } = await service
            .from("certifications")
            .select("id")
            .eq("course_id", enrollment.course_id)
            .eq("status", "active")
            .single();

          if (certification) {
            try {
              await service
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

          // Track course completion event (fire-and-forget)
          trackLearningEvent({
            userId: profile.id,
            eventType: "complete_course",
            courseId: enrollment.course_id,
            metadata: { enrollment_id },
          }).catch(() => {});

          // Fire enrollment.completed webhook (non-blocking)
          dispatchWebhook("enrollment.completed", {
            enrollment_id,
            user_id: profile.id,
            course_id: enrollment.course_id,
          }).catch(() => {});

          // Send course-completion email if the learner has email-on-completion
          // enabled. Default is opt-in, so users with no prefs configured get
          // the email. Skip when no email is on file.
          if (
            (profile as any).email &&
            userMaySend(
              ((profile as any).preferences?.notifications ?? {}) as Record<string, { inApp?: boolean; email?: boolean }>,
              "completions",
              "email"
            )
          ) {
            (async () => {
              const { data: completedCourseRow } = await service
                .from("courses")
                .select("title")
                .eq("id", enrollment.course_id)
                .maybeSingle();
              const { data: enrollmentRow } = await service
                .from("enrollments")
                .select("score")
                .eq("id", enrollment_id)
                .maybeSingle();
              const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
              const learnerName =
                `${(profile as any).first_name ?? ""} ${(profile as any).last_name ?? ""}`.trim() || "there";
              const template = courseCompletion({
                learnerName,
                courseName: completedCourseRow?.title ?? "Course",
                score: Number(enrollmentRow?.score) || 0,
                certificateUrl: `${appUrl}/learn/transcript`,
                dashboardUrl: `${appUrl}/dashboard`,
              });
              await sendEmail({
                to: (profile as any).email,
                subject: template.subject,
                html: template.html,
                text: template.text,
              }).catch(() => {});
            })().catch(() => {});
          }

          // If this is a CPE-eligible course and the learner met the passing
          // score, fire cpe.credits_awarded for external compliance systems.
          const { data: completedCourse } = await service
            .from("courses")
            .select("metadata, passing_score")
            .eq("id", enrollment.course_id)
            .maybeSingle();
          const completedMeta = (completedCourse?.metadata ?? {}) as Record<string, unknown>;
          if (completedMeta.nasba_cpe) {
            const passingScore = Number(completedCourse?.passing_score) || 0;
            const { data: enr } = await service
              .from("enrollments")
              .select("score")
              .eq("id", enrollment_id)
              .maybeSingle();
            const score = Number(enr?.score) || 0;
            if (passingScore === 0 || score >= passingScore) {
              dispatchWebhook("cpe.credits_awarded", {
                enrollment_id,
                user_id: profile.id,
                course_id: enrollment.course_id,
                cpe_credits: Number(completedMeta.cpe_credits) || 0,
                course_version: completedMeta.course_version ?? null,
                score,
                passing_score: passingScore,
              }).catch(() => {});
            }
          }

          // Create evaluation survey assignments for this course (non-blocking)
          createEvaluationAssignments({
            userId: profile.id,
            courseId: enrollment.course_id,
            enrollmentId: enrollment_id,
          }).catch(() => {});
        }
      }
    }

    return jsonNoStore({ ok: true, newBadges, courseCompleted });
  }

  return jsonNoStore({ ok: true });
}

// Support sendBeacon (which sends POST)
export async function POST(request: NextRequest) {
  return PATCH(request);
}
