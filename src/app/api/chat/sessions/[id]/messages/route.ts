import { authorize } from "@/lib/auth/authorize";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { validateBody, sendChatMessageSchema } from "@/lib/validations";
import { rateLimit } from "@/lib/rate-limit";
import { getSystemPrompt, buildChatMessages, generateResponse, summarizeConversation } from "@/lib/ai/chatbot";
import type { ChatMessage } from "@/lib/ai/chatbot";

// Pulls a course's module/lesson structure (with short content excerpts) so
// the assistant can re-teach and build practice questions from real material.
async function buildCourseOutline(
  service: ReturnType<typeof createServiceClient>,
  courseId: string
): Promise<string | undefined> {
  const { data: modules } = await service
    .from("modules")
    .select("id, title, sequence_order, lessons(title, content_type, content_data, sequence_order)")
    .eq("course_id", courseId)
    .order("sequence_order", { ascending: true });

  if (!modules || modules.length === 0) return undefined;

  const extractText = (content_data: unknown): string => {
    if (!content_data || typeof content_data !== "object") return "";
    const d = content_data as Record<string, unknown>;
    const raw = d.text ?? d.body ?? d.html ?? d.content ?? "";
    if (typeof raw !== "string") return "";
    return raw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 400);
  };

  const lines: string[] = [];
  for (const [mi, m] of (modules as any[]).entries()) {
    lines.push(`Module ${mi + 1}: ${m.title}`);
    const lessons = ((m.lessons as any[]) || []).sort(
      (a, b) => (a.sequence_order ?? 0) - (b.sequence_order ?? 0)
    );
    for (const l of lessons) {
      lines.push(`  - ${l.title} (${l.content_type})`);
      const excerpt = extractText(l.content_data);
      if (excerpt) lines.push(`      ${excerpt}`);
    }
  }

  // Keep the prompt bounded.
  return lines.join("\n").slice(0, 6000);
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorize();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const rl = await rateLimit(`chat-ai-msg:${auth.user.id}`, 10, 60000);
  if (!rl.success) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });

  const { id } = await params;
  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const validation = validateBody(sendChatMessageSchema, body);
  if (!validation.success) return NextResponse.json({ error: validation.error }, { status: 400 });

  const service = createServiceClient();

  // Verify session ownership
  const { data: session } = await service
    .from("chat_sessions")
    .select("*, course:courses(id, title)")
    .eq("id", id)
    .eq("user_id", auth.user.id)
    .single();

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  // Get conversation history
  const { data: existingMessages } = await service
    .from("chat_messages")
    .select("role, content")
    .eq("session_id", id)
    .order("created_at", { ascending: true });

  const history: ChatMessage[] = (existingMessages || []).map((m) => ({
    role: m.role as ChatMessage["role"],
    content: m.content,
  }));

  // Build messages for the model, grounding course/assessment help in the
  // selected course's actual outline and content.
  const courseTitle = (session.course as any)?.title;
  const courseId = (session.course as any)?.id ?? session.context_course_id;
  let courseOutline: string | undefined;
  if (
    courseId &&
    (session.context_type === "course" || session.context_type === "assessment")
  ) {
    courseOutline = await buildCourseOutline(service, courseId);
  }
  const systemPrompt = getSystemPrompt(session.context_type, courseTitle, courseOutline);
  const messages = buildChatMessages(systemPrompt, history, validation.data.content);

  // Save user message
  const { data: userMsg } = await service
    .from("chat_messages")
    .insert({
      session_id: id,
      role: "user",
      content: validation.data.content,
    })
    .select()
    .single();

  // Generate AI response
  let aiContent: string;
  let tokensUsed = 0;
  try {
    const result = await generateResponse(messages, session.context_type);
    aiContent = result.content;
    tokensUsed = result.tokensUsed;
  } catch (err) {
    console.error("AI generation error:", err);
    aiContent = "I apologize, but I encountered an error while processing your request. Please try again in a moment.";
  }

  // Save assistant message
  const { data: assistantMsg } = await service
    .from("chat_messages")
    .insert({
      session_id: id,
      role: "assistant",
      content: aiContent,
      tokens_used: tokensUsed,
    })
    .select()
    .single();

  // Update session metadata
  const newCount = (session.message_count || 0) + 2;
  const updates: Record<string, any> = {
    message_count: newCount,
    last_message_at: new Date().toISOString(),
  };

  // Auto-title after first exchange
  if (session.message_count === 0 || session.title === "New Conversation") {
    try {
      const title = await summarizeConversation([
        { role: "user", content: validation.data.content },
        { role: "assistant", content: aiContent },
      ]);
      updates.title = title.slice(0, 200);
    } catch {
      updates.title = validation.data.content.slice(0, 60);
    }
  }

  await service
    .from("chat_sessions")
    .update(updates)
    .eq("id", id);

  return NextResponse.json({
    userMessage: userMsg,
    assistantMessage: assistantMsg,
    session: { ...session, ...updates },
  });
}
