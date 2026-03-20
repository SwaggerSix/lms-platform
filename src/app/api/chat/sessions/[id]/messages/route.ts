import { authorize } from "@/lib/auth/authorize";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { validateBody, sendChatMessageSchema } from "@/lib/validations";
import { rateLimit } from "@/lib/rate-limit";
import { getSystemPrompt, buildChatMessages, generateResponse, summarizeConversation } from "@/lib/ai/chatbot";
import type { ChatMessage } from "@/lib/ai/chatbot";

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

  // Build messages for OpenAI
  const courseTitle = (session.course as any)?.title;
  const systemPrompt = getSystemPrompt(session.context_type, courseTitle);
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
