import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/auth/authorize";
import { rateLimit } from "@/lib/rate-limit";
import { locales } from "@/i18n/config";
import { getAI } from "@/lib/ai/openai";

export async function POST(request: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      {
        error:
          "AI API key is not configured. Please set the ANTHROPIC_API_KEY environment variable.",
      },
      { status: 503 }
    );
  }

  const auth = await authorize("admin", "instructor");
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const rateLimitResult = await rateLimit(`ai-translate-${auth.user.id}`, 10, 60000);
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Please wait a moment before trying again." },
      { status: 429 }
    );
  }

  let body: { text?: string; target_locale?: string; source_locale?: string };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { text, target_locale, source_locale } = body;

  if (!text || typeof text !== "string" || text.trim().length === 0) {
    return NextResponse.json({ error: "Text is required and must be a non-empty string." }, { status: 400 });
  }

  if (!target_locale || !locales.includes(target_locale as (typeof locales)[number])) {
    return NextResponse.json({ error: `Invalid target_locale. Must be one of: ${locales.join(", ")}` }, { status: 400 });
  }

  const resolvedSource = source_locale || "en";

  if (resolvedSource === target_locale) {
    return NextResponse.json({ translated_text: text, source_locale: resolvedSource, target_locale });
  }

  const localeNameMap: Record<string, string> = {
    en: "English", es: "Spanish", fr: "French", de: "German",
    pt: "Portuguese", ja: "Japanese", zh: "Chinese (Simplified)",
  };

  const sourceName = localeNameMap[resolvedSource] || resolvedSource;
  const targetName = localeNameMap[target_locale] || target_locale;

  try {
    const client = getAI();
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      system: `You are a professional translator specializing in educational and e-learning content. Translate the following text from ${sourceName} to ${targetName}. Maintain the original formatting, including any HTML tags, markdown, or special characters. Preserve the tone and style appropriate for a learning management system. Only return the translated text, nothing else.`,
      messages: [{ role: "user", content: text }],
      max_tokens: Math.min(text.length * 3, 4000),
      temperature: 0.3,
    });

    const translatedText = response.content[0]?.type === "text" ? response.content[0].text.trim() : "";

    if (!translatedText) {
      return NextResponse.json({ error: "Translation returned empty result." }, { status: 500 });
    }

    return NextResponse.json({
      translated_text: translatedText,
      source_locale: resolvedSource,
      target_locale,
    });
  } catch (err: unknown) {
    console.error("Translation error:", err);
    return NextResponse.json({ error: "Failed to connect to translation service. Please try again later." }, { status: 500 });
  }
}
