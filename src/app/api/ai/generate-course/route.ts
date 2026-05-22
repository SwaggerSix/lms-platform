import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/auth/authorize";
import { rateLimit } from "@/lib/rate-limit";
import { generateCourseOutline, generateCourseFromMaterials } from "@/lib/ai/course-generator";
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

  const rateLimitResult = await rateLimit(`ai-course-${auth.user.id}`, 5, 60000);
  if (!rateLimitResult.success) {
    return jsonNoStore(
      { error: "Rate limit exceeded. Please wait a moment before trying again." },
      { status: 429 }
    );
  }

  let body: {
    topic?: string;
    source_material?: string;
    difficulty?: string;
    estimated_duration?: string;
    target_audience?: string;
    course_type?: string;
    title?: string;
  };

  try {
    body = await request.json();
  } catch {
    return jsonNoStore({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { topic, source_material, difficulty, estimated_duration, target_audience, course_type, title } = body;

  if (!topic && !source_material) {
    return jsonNoStore(
      { error: "Either 'topic' or 'source_material' is required." },
      { status: 400 }
    );
  }

  try {
    let outline;

    if (source_material) {
      outline = await generateCourseFromMaterials(source_material, {
        title,
        difficulty,
        format: course_type,
      });
    } else {
      outline = await generateCourseOutline(topic!, {
        difficulty,
        duration: estimated_duration,
        targetAudience: target_audience,
        courseType: course_type,
      });
    }

    return jsonNoStore(outline);
  } catch (error) {
    console.error("AI course generation error:", error);
    const message = error instanceof Error ? error.message : "Failed to generate course outline";
    return jsonNoStore({ error: message }, { status: 500 });
  }
}
