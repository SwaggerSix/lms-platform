import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

function corsHeaders(origin: string | null, allowedDomains: string[]) {
  // If no domains configured, allow all
  const allowOrigin =
    allowedDomains.length === 0 || (origin && allowedDomains.some((d) => origin.includes(d)))
      ? origin || "*"
      : "";

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(request.headers.get("origin"), []),
  });
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const service = createServiceClient();

  const { data: widget, error } = await service
    .from("embed_widgets")
    .select("*")
    .eq("embed_token", token)
    .eq("is_active", true)
    .single();

  if (error || !widget) {
    return NextResponse.json({ error: "Widget not found" }, { status: 404 });
  }

  const origin = request.headers.get("origin");
  const allowedDomains = (widget.allowed_domains as string[]) || [];
  const headers = corsHeaders(origin, allowedDomains);

  if (headers["Access-Control-Allow-Origin"] === "") {
    return NextResponse.json({ error: "Origin not allowed" }, { status: 403, headers });
  }

  // Fetch data based on widget type
  let widgetData: Record<string, unknown> = {
    widget_type: widget.widget_type,
    name: widget.name,
    config: widget.config,
  };

  switch (widget.widget_type) {
    case "nugget_feed": {
      const limit = (widget.config as any)?.limit || 5;
      const { data: nuggets } = await service
        .from("microlearning_nuggets")
        .select("id, title, content_type, content, difficulty, estimated_seconds")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(limit);
      widgetData.nuggets = nuggets || [];
      break;
    }
    case "leaderboard": {
      const limit = (widget.config as any)?.limit || 10;
      const { data: leaders } = await service
        .from("microlearning_progress")
        .select("user_id, status")
        .eq("status", "completed");

      // Aggregate completions per user
      const counts: Record<string, number> = {};
      for (const l of leaders ?? []) {
        counts[l.user_id] = (counts[l.user_id] || 0) + 1;
      }
      const sorted = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([user_id, completions], i) => ({ rank: i + 1, user_id, completions }));
      widgetData.leaderboard = sorted;
      break;
    }
    case "course_card": {
      const courseId = (widget.config as any)?.course_id;
      if (courseId) {
        const { data: course } = await service
          .from("courses")
          .select("id, title, description, thumbnail_url, difficulty_level, estimated_duration")
          .eq("id", courseId)
          .single();
        widgetData.course = course;
      }
      break;
    }
    case "progress_bar": {
      const userId = (widget.config as any)?.user_id;
      const courseId = (widget.config as any)?.course_id;
      if (userId && courseId) {
        const { data: enrollment } = await service
          .from("enrollments")
          .select("status, progress")
          .eq("user_id", userId)
          .eq("course_id", courseId)
          .single();
        widgetData.enrollment = enrollment;
      }
      break;
    }
    case "skill_radar": {
      const userId = (widget.config as any)?.user_id;
      if (userId) {
        const { data: skills } = await service
          .from("user_skills")
          .select("*, skill:skills(name)")
          .eq("user_id", userId)
          .limit(10);
        widgetData.skills = skills || [];
      }
      break;
    }
  }

  return NextResponse.json(widgetData, { headers });
}
