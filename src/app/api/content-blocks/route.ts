import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/auth/authorize";
import { createServiceClient } from "@/lib/supabase/service";
import { rateLimit } from "@/lib/rate-limit";
import { z } from "zod";
import { validateBody } from "@/lib/validations";

const createBlockSchema = z.object({
  lesson_id: z.string().uuid(),
  block_type: z.enum([
    "text", "heading", "image", "video", "code",
    "embed", "quiz_inline", "divider", "callout",
    "accordion", "tabs",
  ]),
  content: z.record(z.string(), z.unknown()).default({}),
  sequence_order: z.number().int().min(0),
});

export async function GET(request: NextRequest) {
  const auth = await authorize("admin", "instructor");
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { searchParams } = new URL(request.url);
  const lessonId = searchParams.get("lesson_id");

  if (!lessonId) {
    return NextResponse.json({ error: "lesson_id is required" }, { status: 400 });
  }

  const service = createServiceClient();
  const { data, error } = await service
    .from("content_blocks")
    .select("*")
    .eq("lesson_id", lessonId)
    .order("sequence_order", { ascending: true });

  if (error) {
    console.error("Content blocks GET error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ blocks: data });
}

export async function POST(request: NextRequest) {
  const auth = await authorize("admin", "instructor");
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const rl = await rateLimit(`content-blocks-create:${auth.user.id}`, 60, 60000);
  if (!rl.success) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const body = await request.json();
  const validation = validateBody(createBlockSchema, body);
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const service = createServiceClient();
  const { data, error } = await service
    .from("content_blocks")
    .insert({
      lesson_id: validation.data.lesson_id,
      block_type: validation.data.block_type,
      content: validation.data.content,
      sequence_order: validation.data.sequence_order,
    })
    .select()
    .single();

  if (error) {
    console.error("Content blocks POST error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ block: data }, { status: 201 });
}
