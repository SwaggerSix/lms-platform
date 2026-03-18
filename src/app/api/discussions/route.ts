import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { validateBody, createDiscussionSchema } from "@/lib/validations";

/**
 * POST /api/discussions
 * Actions: create_thread, reply, upvote
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const body = await request.json();
  const validation = validateBody(createDiscussionSchema, body);
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const service = createServiceClient();
  const { data: profile } = await service
    .from("users")
    .select("id")
    .eq("auth_id", authData.user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const action = body.action;

  // ---- Create a new top-level discussion thread ----
  if (action === "create_thread") {
    const { title, body: threadBody, course } = body;

    if (!title || !threadBody) {
      return NextResponse.json(
        { error: "title and body are required" },
        { status: 400 }
      );
    }

    // Optionally resolve course name to course_id
    let courseId: string | null = null;
    if (course) {
      const { data: courseRow } = await service
        .from("courses")
        .select("id")
        .ilike("title", `%${course.replace(/[%_\\'"()]/g, "")}%`)
        .limit(1)
        .single();
      courseId = courseRow?.id ?? null;
    }

    const { data: thread, error } = await service
      .from("discussions")
      .insert({
        user_id: profile.id,
        title,
        body: threadBody,
        course_id: courseId,
        parent_id: null,
        upvotes: 0,
        is_pinned: false,
        is_answer: false,
      })
      .select()
      .single();

    if (error) {
      console.error("Discussions API error:", error.message);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }

    return NextResponse.json({ thread }, { status: 201 });
  }

  // ---- Reply to an existing thread ----
  if (action === "reply") {
    const { thread_id, body: replyBody } = body;

    if (!thread_id || !replyBody) {
      return NextResponse.json(
        { error: "thread_id and body are required" },
        { status: 400 }
      );
    }

    const { data: reply, error } = await service
      .from("discussions")
      .insert({
        user_id: profile.id,
        parent_id: thread_id,
        body: replyBody,
        title: null,
        course_id: null,
        upvotes: 0,
        is_pinned: false,
        is_answer: false,
      })
      .select()
      .single();

    if (error) {
      console.error("Discussions API error:", error.message);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }

    return NextResponse.json({ reply }, { status: 201 });
  }

  // ---- Upvote a discussion post ----
  if (action === "upvote") {
    const { discussion_id } = body;

    if (!discussion_id) {
      return NextResponse.json(
        { error: "discussion_id is required" },
        { status: 400 }
      );
    }

    // Increment upvotes
    const { data: current } = await service
      .from("discussions")
      .select("upvotes")
      .eq("id", discussion_id)
      .single();

    if (!current) {
      return NextResponse.json(
        { error: "Discussion not found" },
        { status: 404 }
      );
    }

    const { data: updated, error } = await service
      .from("discussions")
      .update({ upvotes: (current.upvotes ?? 0) + 1 })
      .eq("id", discussion_id)
      .select()
      .single();

    if (error) {
      console.error("Discussions API error:", error.message);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }

    return NextResponse.json({ discussion: updated });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
