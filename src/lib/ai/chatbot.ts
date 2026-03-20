import { getAI } from "@/lib/ai/openai";

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

const SYSTEM_PROMPTS: Record<string, string> = {
  general: `You are an intelligent learning assistant for an LMS (Learning Management System) platform.
Your role is to help learners with their educational journey. You can:
- Answer questions about learning topics
- Explain complex concepts in simple terms
- Suggest study strategies and techniques
- Help with goal setting and learning plans
- Provide encouragement and motivation
Keep responses helpful, concise, and educational. Use markdown formatting when helpful.`,

  course: `You are a course-specific learning assistant. You help students understand course material,
answer questions about lessons, and provide additional context and examples.
When discussing course content:
- Reference specific concepts from the course when possible
- Provide real-world examples to illustrate points
- Break down complex topics into manageable pieces
- Suggest related topics for deeper understanding
Keep responses focused on the course material and educational outcomes.`,

  assessment: `You are an assessment preparation assistant. You help students prepare for quizzes,
exams, and assessments. You can:
- Explain concepts that might appear on assessments
- Provide practice questions and scenarios
- Help identify knowledge gaps
- Suggest study strategies for different question types
IMPORTANT: Never provide direct answers to actual assessment questions. Instead, guide students
to understand the underlying concepts so they can answer on their own.`,

  career: `You are a career guidance assistant within a learning platform. You help learners:
- Identify skills gaps for their career goals
- Suggest relevant courses and learning paths
- Provide industry insights and trends
- Help with professional development planning
- Offer advice on certifications and credentials
Be practical, encouraging, and realistic in your career guidance.`,
};

export function getSystemPrompt(contextType: string, courseTitle?: string): string {
  let prompt = SYSTEM_PROMPTS[contextType] || SYSTEM_PROMPTS.general;
  if (contextType === "course" && courseTitle) {
    prompt += `\n\nThe student is currently studying: "${courseTitle}". Tailor your responses to this course context.`;
  }
  return prompt;
}

export function buildChatMessages(
  systemPrompt: string,
  history: ChatMessage[],
  userMessage: string
): Array<{ role: "system" | "user" | "assistant"; content: string }> {
  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: systemPrompt },
  ];

  const recentHistory = history.slice(-20);
  for (const msg of recentHistory) {
    if (msg.role === "system") continue;
    messages.push({ role: msg.role, content: msg.content });
  }

  messages.push({ role: "user", content: userMessage });
  return messages;
}

/**
 * Convert message array to Anthropic format (system prompt separate from messages).
 */
function toAnthropicMessages(messages: Array<{ role: string; content: string }>) {
  const systemMsg = messages.find((m) => m.role === "system");
  const chatMessages = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

  return { system: systemMsg?.content || "", messages: chatMessages };
}

export async function generateResponse(
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
  _context?: string
): Promise<{ content: string; tokensUsed: number }> {
  const client = getAI();
  const { system, messages: chatMessages } = toAnthropicMessages(messages);

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    system,
    messages: chatMessages,
    max_tokens: 1024,
    temperature: 0.7,
  });

  const content = response.content[0]?.type === "text"
    ? response.content[0].text
    : "I apologize, but I was unable to generate a response. Please try again.";
  const tokensUsed = (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0);

  return { content, tokensUsed };
}

export async function summarizeConversation(
  messages: ChatMessage[]
): Promise<string> {
  const client = getAI();

  const conversationText = messages
    .filter((m) => m.role !== "system")
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n");

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    system: "Summarize the following conversation in a brief title (max 60 characters). Return only the title, nothing else.",
    messages: [{ role: "user", content: conversationText }],
    max_tokens: 60,
    temperature: 0.3,
  });

  return response.content[0]?.type === "text" ? response.content[0].text : "Conversation";
}

export async function suggestNextSteps(
  recentTopics: string[],
  contextType: string
): Promise<string[]> {
  const client = getAI();

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    system: `Based on the learning topics discussed, suggest 3-4 short follow-up questions or next steps
the learner might want to explore. Context: ${contextType}. Return as a JSON array of strings.`,
    messages: [{ role: "user", content: `Recent topics: ${recentTopics.join(", ")}` }],
    max_tokens: 200,
    temperature: 0.7,
  });

  try {
    const raw = response.content[0]?.type === "text" ? response.content[0].text : "[]";
    const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    return JSON.parse(cleaned);
  } catch {
    return [
      "Can you explain this concept further?",
      "What are some practical examples?",
      "How does this relate to other topics?",
    ];
  }
}
