import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/auth/authorize";
import { rateLimit } from "@/lib/rate-limit";
import { generateLessonContent } from "@/lib/ai/course-generator";
import { jsonNoStore } from "@/lib/api/no-store";

export async function POST(request: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return jsonNoStore(
      { error: "Anthropic API key is not configured. Please set the ANTHROPIC_API_KEY environment variable." },
      { status: 503 }
    );
  }

  const auth = await authorize("admin", "instructor");
  if (!auth.authorized) {
    return jsonNoStore({ error: auth.error }, { status: auth.status });
  }

  const rateLimitResult = await rateLimit(`ai-content-${auth.user.id}`, 10, 60000);
  if (!rateLimitResult.success) {
    return jsonNoStore(
      { error: "Rate limit exceeded. Please wait a moment before trying again." },
      { status: 429 }
    );
  }

  let body: {
    lesson_title?: string;
    course_context?: string;
    content_type?: string;
  };

  try {
    body = await request.json();
  } catch {
    return jsonNoStore({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { lesson_title, course_context, content_type } = body;

  if (!lesson_title) {
    return jsonNoStore({ error: "'lesson_title' is required." }, { status: 400 });
  }

  try {
    const content = await generateLessonContent(
      lesson_title,
      course_context || "",
      content_type || "document"
    );

    return jsonNoStore(content);
  } catch (error) {
    console.error("AI content generation error:", error);
    const message = error instanceof Error ? error.message : "Failed to generate lesson content";
    return jsonNoStore({ error: message }, { status: 500 });
  }
}
