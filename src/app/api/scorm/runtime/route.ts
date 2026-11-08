import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isUuid, sanitizeRuntimeState, scorePercent } from "@/lib/scorm/package";

/**
 * SCORM runtime persistence (resume + score), stored on the learner's
 * lesson_progress row under bookmark_data.scorm.
 *
 *   GET  /api/scorm/runtime?enrollment_id=…&lesson_id=…   → { state | null }
 *   PUT  /api/scorm/runtime  { enrollment_id, lesson_id, state }
 *   POST (same as PUT, for navigator.sendBeacon on page unload)
 *
 * Completion is NOT set here: the player reports it through
 * /api/enrollments/progress so points, badges, course completion and
 * certificates all fire from one place.
 */

const MAX_BODY_BYTES = 200 * 1024;

async function resolveContext(enrollmentId: string, lessonId: string) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Unauthorized", status: 401 } as const;

  const service = createServiceClient();
  const { data: profile } = await service.from("users").select("id").eq("auth_id", auth.user.id).single();
  if (!profile) return { error: "User profile not found", status: 404 } as const;

  const { data: enrollment } = await service
    .from("enrollments")
    .select("id, user_id, course_id")
    .eq("id", enrollmentId)
    .single();
  if (!enrollment || enrollment.user_id !== profile.id) {
    return { error: "Enrollment not found", status: 404 } as const;
  }

  const { data: lesson } = await service
    .from("lessons")
    .select("id, module:modules!lessons_module_id_fkey(course_id)")
    .eq("id", lessonId)
    .single();
  const mod = (lesson as any)?.module;
  const courseId = Array.isArray(mod) ? mod[0]?.course_id : mod?.course_id;
  if (!lesson || courseId !== enrollment.course_id) {
    return { error: "Lesson not found", status: 404 } as const;
  }

  return { service, profileId: profile.id as string } as const;
}

export async function GET(request: NextRequest) {
  const enrollmentId = request.nextUrl.searchParams.get("enrollment_id") ?? "";
  const lessonId = request.nextUrl.searchParams.get("lesson_id") ?? "";
  if (!isUuid(enrollmentId) || !isUuid(lessonId)) {
    return NextResponse.json({ error: "enrollment_id and lesson_id are required" }, { status: 400 });
  }
  const ctx = await resolveContext(enrollmentId, lessonId);
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

  const { data: row } = await ctx.service
    .from("lesson_progress")
    .select("bookmark_data, status")
    .eq("enrollment_id", enrollmentId)
    .eq("lesson_id", lessonId)
    .maybeSingle();

  const state = sanitizeRuntimeState((row?.bookmark_data as any)?.scorm ?? null);
  return NextResponse.json(
    { state, lessonCompleted: row?.status === "completed" },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function PUT(request: NextRequest) {
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const enrollmentId = typeof body.enrollment_id === "string" ? body.enrollment_id : "";
  const lessonId = typeof body.lesson_id === "string" ? body.lesson_id : "";
  if (!isUuid(enrollmentId) || !isUuid(lessonId)) {
    return NextResponse.json({ error: "enrollment_id and lesson_id are required" }, { status: 400 });
  }
  const state = sanitizeRuntimeState(body.state);
  if (!state) return NextResponse.json({ error: "state is required" }, { status: 400 });

  const ctx = await resolveContext(enrollmentId, lessonId);
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  const { service, profileId } = ctx;

  const score = scorePercent(state);
  const { data: existing } = await service
    .from("lesson_progress")
    .select("id, bookmark_data")
    .eq("enrollment_id", enrollmentId)
    .eq("lesson_id", lessonId)
    .maybeSingle();

  const prevBookmark =
    existing?.bookmark_data && typeof existing.bookmark_data === "object" && !Array.isArray(existing.bookmark_data)
      ? (existing.bookmark_data as Record<string, unknown>)
      : {};
  const bookmark = { ...prevBookmark, scorm: { ...state, updatedAt: new Date().toISOString() } };

  if (existing) {
    const update: Record<string, unknown> = { bookmark_data: bookmark };
    if (score !== null) update.score = score;
    const { error } = await service.from("lesson_progress").update(update).eq("id", existing.id);
    if (error) {
      console.error("SCORM runtime update error:", error.message);
      return NextResponse.json({ error: "An internal error occurred" }, { status: 500 });
    }
  } else {
    const { error } = await service.from("lesson_progress").insert({
      user_id: profileId,
      enrollment_id: enrollmentId,
      lesson_id: lessonId,
      status: "in_progress",
      started_at: new Date().toISOString(),
      bookmark_data: bookmark,
      ...(score !== null ? { score } : {}),
    });
    if (error) {
      console.error("SCORM runtime insert error:", error.message);
      return NextResponse.json({ error: "An internal error occurred" }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}

// navigator.sendBeacon only sends POST.
export async function POST(request: NextRequest) {
  return PUT(request);
}
