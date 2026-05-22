import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/auth/authorize";
import { rateLimit } from "@/lib/rate-limit";
import { generateQuizQuestions } from "@/lib/ai/course-generator";
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

  const rateLimitResult = await rateLimit(`ai-quiz-${auth.user.id}`, 10, 60000);
  if (!rateLimitResult.success) {
    return jsonNoStore(
      { error: "Rate limit exceeded. Please wait a moment before trying again." },
      { status: 429 }
    );
  }

  let body: {
    topic?: string;
    context?: string;
    count?: number;
    difficulty?: string;
  };

  try {
    body = await request.json();
  } catch {
    return jsonNoStore({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { topic, context, count, difficulty } = body;

  if (!topic) {
    return jsonNoStore({ error: "'topic' is required." }, { status: 400 });
  }

  try {
    const questions = await generateQuizQuestions(
      topic,
      context || "",
      Math.min(count || 5, 20),
      difficulty || "intermediate"
    );

    return jsonNoStore({ questions });
  } catch (error) {
    console.error("AI quiz generation error:", error);
    const message = error instanceof Error ? error.message : "Failed to generate quiz questions";
    return jsonNoStore({ error: message }, { status: 500 });
  }
}
