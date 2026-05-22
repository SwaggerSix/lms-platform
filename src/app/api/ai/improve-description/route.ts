import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/auth/authorize";
import { rateLimit } from "@/lib/rate-limit";
import { improveCourseDescription } from "@/lib/ai/course-generator";
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

  const rateLimitResult = await rateLimit(`ai-desc-${auth.user.id}`, 10, 60000);
  if (!rateLimitResult.success) {
    return jsonNoStore(
      { error: "Rate limit exceeded. Please wait a moment before trying again." },
      { status: 429 }
    );
  }

  let body: {
    description?: string;
    title?: string;
  };

  try {
    body = await request.json();
  } catch {
    return jsonNoStore({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { description, title } = body;

  if (!description || !title) {
    return jsonNoStore({ error: "Both 'description' and 'title' are required." }, { status: 400 });
  }

  try {
    const improved = await improveCourseDescription(description, title);
    return jsonNoStore(improved);
  } catch (error) {
    console.error("AI description improvement error:", error);
    const message = error instanceof Error ? error.message : "Failed to improve description";
    return jsonNoStore({ error: message }, { status: 500 });
  }
}
