import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { trackLearningEvent } from "@/lib/ai/track-event";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";

  const empty = { courses: [], articles: [], users: [], documents: [] };

  if (q.length < 2) {
    return NextResponse.json(empty);
  }

  const sanitized = q.replace(/[%_\\'"()]/g, "");
  const pattern = `%${sanitized}%`;

  const service = createServiceClient();

  // Determine caller role for user search gating
  const { data: caller } = await service
    .from("users")
    .select("id, role")
    .eq("auth_id", user.id)
    .single();

  const callerRole = caller?.role as string | undefined;

  const [coursesResult, articlesResult, usersResult, documentsResult] =
    await Promise.all([
      // 1. Courses
      service
        .from("courses")
        .select("id, title, slug, thumbnail_url, status")
        .eq("status", "published")
        .ilike("title", pattern)
        .limit(5),

      // 2. Knowledge base articles
      service
        .from("kb_articles")
        .select("id, title, slug, category_id")
        .or(`title.ilike.${pattern},excerpt.ilike.${pattern}`)
        .limit(5),

      // 3. Users (admin/manager only)
      callerRole === "admin" || callerRole === "manager"
        ? service
            .from("users")
            .select("id, first_name, last_name, email, role")
            .or(
              `first_name.ilike.${pattern},last_name.ilike.${pattern},email.ilike.${pattern}`
            )
            .limit(5)
        : Promise.resolve({ data: [], error: null }),

      // 4. Documents
      service
        .from("documents")
        .select("id, title, file_type")
        .ilike("title", pattern)
        .limit(5),
    ]);

  if (
    coursesResult.error ||
    articlesResult.error ||
    usersResult.error ||
    documentsResult.error
  ) {
    console.error("Search API error:", {
      courses: coursesResult.error?.message,
      articles: articlesResult.error?.message,
      users: usersResult.error?.message,
      documents: documentsResult.error?.message,
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }

  // Track search event (fire-and-forget)
  if (caller) {
    trackLearningEvent({
      userId: caller.id,
      eventType: "search",
      metadata: {
        query: q,
        results_count:
          (coursesResult.data?.length ?? 0) +
          (articlesResult.data?.length ?? 0) +
          (documentsResult.data?.length ?? 0),
      },
    }).catch(() => {});
  }

  return NextResponse.json({
    courses: coursesResult.data ?? [],
    articles: articlesResult.data ?? [],
    users: usersResult.data ?? [],
    documents: documentsResult.data ?? [],
  });
}
