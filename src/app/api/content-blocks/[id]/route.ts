import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/auth/authorize";
import { createServiceClient } from "@/lib/supabase/service";
import { rateLimit } from "@/lib/rate-limit";
import { z } from "zod";
import { validateBody } from "@/lib/validations";

const updateBlockSchema = z.object({
  block_type: z.enum([
    "text", "heading", "image", "video", "code",
    "embed", "quiz_inline", "divider", "callout",
    "accordion", "tabs",
  ]).optional(),
  content: z.record(z.string(), z.unknown()).optional(),
  sequence_order: z.number().int().min(0).optional(),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorize("admin", "instructor");
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const rl = await rateLimit(`content-blocks-update:${auth.user.id}`, 120, 60000);
  if (!rl.success) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const { id } = await params;
  const body = await request.json();
  const validation = validateBody(updateBlockSchema, body);
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const service = createServiceClient();
  const { data, error } = await service
    .from("content_blocks")
    .update(validation.data)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Content block PUT error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "Block not found" }, { status: 404 });
  }

  return NextResponse.json({ block: data });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorize("admin", "instructor");
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await params;
  const service = createServiceClient();

  const { error } = await service
    .from("content_blocks")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Content block DELETE error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
