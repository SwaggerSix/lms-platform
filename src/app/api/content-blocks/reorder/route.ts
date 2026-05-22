import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/auth/authorize";
import { createServiceClient } from "@/lib/supabase/service";
import { rateLimit } from "@/lib/rate-limit";
import { z } from "zod";
import { validateBody } from "@/lib/validations";
import { jsonNoStore } from "@/lib/api/no-store";

const reorderSchema = z.object({
  lesson_id: z.string().uuid(),
  block_ids: z.array(z.string().uuid()).min(1),
});

export async function PUT(request: NextRequest) {
  const auth = await authorize("admin", "instructor");
  if (!auth.authorized) {
    return jsonNoStore({ error: auth.error }, { status: auth.status });
  }

  const rl = await rateLimit(`content-blocks-reorder:${auth.user.id}`, 60, 60000);
  if (!rl.success) {
    return jsonNoStore({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const body = await request.json();
  const validation = validateBody(reorderSchema, body);
  if (!validation.success) {
    return jsonNoStore({ error: validation.error }, { status: 400 });
  }

  const service = createServiceClient();
  const { block_ids, lesson_id } = validation.data;

  // Update each block's sequence_order based on its position in the array
  const updates = block_ids.map((blockId, index) =>
    service
      .from("content_blocks")
      .update({ sequence_order: index })
      .eq("id", blockId)
      .eq("lesson_id", lesson_id)
  );

  const results = await Promise.all(updates);
  const hasError = results.some((r) => r.error);

  if (hasError) {
    console.error("Content blocks reorder error");
    return jsonNoStore({ error: "Internal server error" }, { status: 500 });
  }

  return jsonNoStore({ success: true });
}
