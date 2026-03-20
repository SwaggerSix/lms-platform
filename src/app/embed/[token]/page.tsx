import { createServiceClient } from "@/lib/supabase/service";
import { notFound } from "next/navigation";

interface EmbedPageProps {
  params: Promise<{ token: string }>;
}

export default async function EmbedPage({ params }: EmbedPageProps) {
  const { token } = await params;
  const service = createServiceClient();

  const { data: widget } = await service
    .from("embed_widgets")
    .select("*")
    .eq("embed_token", token)
    .eq("is_active", true)
    .single();

  if (!widget) notFound();

  // Fetch widget-specific data
  let content: any = null;

  switch (widget.widget_type) {
    case "nugget_feed": {
      const limit = (widget.config as any)?.limit || 5;
      const { data } = await service
        .from("microlearning_nuggets")
        .select("id, title, content_type, content, difficulty, estimated_seconds")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(limit);
      content = data;
      break;
    }
    case "leaderboard": {
      const { data: leaders } = await service
        .from("microlearning_progress")
        .select("user_id")
        .eq("status", "completed");
      const counts: Record<string, number> = {};
      for (const l of leaders ?? []) {
        counts[l.user_id] = (counts[l.user_id] || 0) + 1;
      }
      content = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([, completions], i) => ({ rank: i + 1, completions }));
      break;
    }
    case "course_card": {
      const courseId = (widget.config as any)?.course_id;
      if (courseId) {
        const { data } = await service
          .from("courses")
          .select("id, title, description, thumbnail_url, difficulty_level, estimated_duration")
          .eq("id", courseId)
          .single();
        content = data;
      }
      break;
    }
  }

  const typeColors: Record<string, string> = {
    tip: "border-l-amber-500",
    flashcard: "border-l-blue-500",
    quiz: "border-l-purple-500",
    video_clip: "border-l-red-500",
    infographic: "border-l-green-500",
    checklist: "border-l-cyan-500",
  };

  return (
    <html>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{widget.name}</title>
        <style>{`
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f9fafb; color: #111827; }
          .container { padding: 16px; max-width: 600px; margin: 0 auto; }
          .header { font-size: 14px; font-weight: 600; color: #374151; margin-bottom: 12px; }
          .card { background: white; border-radius: 8px; padding: 12px 16px; margin-bottom: 8px; border: 1px solid #e5e7eb; border-left: 3px solid #6366f1; }
          .card-title { font-size: 13px; font-weight: 600; color: #111827; }
          .card-meta { font-size: 11px; color: #6b7280; margin-top: 4px; }
          .badge { display: inline-block; font-size: 10px; padding: 2px 8px; border-radius: 999px; font-weight: 500; background: #f3f4f6; color: #374151; }
          .leader-row { display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; background: white; border-radius: 8px; margin-bottom: 4px; border: 1px solid #e5e7eb; }
          .leader-rank { font-size: 14px; font-weight: 700; color: #6366f1; width: 30px; }
          .leader-score { font-size: 13px; font-weight: 600; color: #111827; }
          .course-card { background: white; border-radius: 12px; overflow: hidden; border: 1px solid #e5e7eb; }
          .course-gradient { background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 24px; }
          .course-title { font-size: 16px; font-weight: 700; color: white; }
          .course-desc { font-size: 12px; color: rgba(255,255,255,0.8); margin-top: 8px; }
          .course-footer { padding: 12px 16px; }
          .powered { text-align: center; margin-top: 16px; font-size: 10px; color: #9ca3af; }
          .powered a { color: #6366f1; text-decoration: none; }
        `}</style>
      </head>
      <body>
        <div className="container">
          {widget.widget_type === "nugget_feed" && content && (
            <>
              <div className="header">Daily Learning</div>
              {(content as any[]).map((nugget: any) => (
                <div
                  key={nugget.id}
                  className="card"
                  style={{ borderLeftColor: typeColors[nugget.content_type]?.replace("border-l-", "") || "#6366f1" }}
                >
                  <div className="card-title">{nugget.title}</div>
                  <div className="card-meta">
                    <span className="badge">{nugget.content_type.replace("_", " ")}</span>
                    {nugget.difficulty && (
                      <span className="badge" style={{ marginLeft: 4 }}>{nugget.difficulty}</span>
                    )}
                    {nugget.estimated_seconds && (
                      <span style={{ marginLeft: 8 }}>
                        {nugget.estimated_seconds < 60
                          ? `${nugget.estimated_seconds}s`
                          : `${Math.round(nugget.estimated_seconds / 60)}m`}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </>
          )}

          {widget.widget_type === "leaderboard" && content && (
            <>
              <div className="header">Top Learners</div>
              {(content as any[]).map((entry: any) => (
                <div key={entry.rank} className="leader-row">
                  <div className="leader-rank">#{entry.rank}</div>
                  <div className="leader-score">{entry.completions} completed</div>
                </div>
              ))}
            </>
          )}

          {widget.widget_type === "course_card" && content && (
            <div className="course-card">
              <div className="course-gradient">
                <div className="course-title">{(content as any).title}</div>
                {(content as any).description && (
                  <div className="course-desc">{(content as any).description}</div>
                )}
              </div>
              <div className="course-footer">
                {(content as any).difficulty_level && (
                  <span className="badge">{(content as any).difficulty_level}</span>
                )}
                {(content as any).estimated_duration && (
                  <span className="badge" style={{ marginLeft: 4 }}>
                    {(content as any).estimated_duration} min
                  </span>
                )}
              </div>
            </div>
          )}

          {widget.widget_type === "progress_bar" && (
            <div className="card">
              <div className="card-title">Course Progress</div>
              <div style={{ marginTop: 8, height: 8, background: "#e5e7eb", borderRadius: 4, overflow: "hidden" }}>
                <div style={{ height: "100%", background: "#6366f1", borderRadius: 4, width: "0%" }} />
              </div>
            </div>
          )}

          {widget.widget_type === "skill_radar" && (
            <div className="card">
              <div className="card-title">Skills Overview</div>
              <div className="card-meta">Skill radar visualization coming soon.</div>
            </div>
          )}

          <div className="powered">
            Powered by <a href="/">LMS Platform</a>
          </div>
        </div>
      </body>
    </html>
  );
}
