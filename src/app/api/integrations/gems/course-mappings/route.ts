import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authorize } from "@/lib/auth/authorize";
import { createServiceClient } from "@/lib/supabase/service";

// PUT /api/integrations/gems/course-mappings
// Persists GEMS productCode -> LMS course id assignments by writing
// metadata.gems_course_code on each course. Idempotent: re-running with the
// same mapping is a no-op. Setting product_code to null clears the tag.
export const dynamic = "force-dynamic";

const mappingsSchema = z.object({
  mappings: z.array(
    z.object({
      course_id: z.string().uuid(),
      product_code: z.string().min(1).max(50).nullable(),
    })
  ),
});

export async function PUT(request: NextRequest) {
  const auth = await authorize("admin");
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const parsed = mappingsSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const service = createServiceClient();
  const results: Array<{ course_id: string; ok: boolean; error?: string }> = [];

  for (const { course_id, product_code } of parsed.data.mappings) {
    const { data: course, error: fetchErr } = await service
      .from("courses")
      .select("id, metadata")
      .eq("id", course_id)
      .maybeSingle();
    if (fetchErr || !course) {
      results.push({ course_id, ok: false, error: fetchErr?.message ?? "not found" });
      continue;
    }
    const metadata = { ...(course.metadata ?? {}) } as Record<string, unknown>;
    if (product_code === null) {
      delete metadata.gems_course_code;
    } else {
      metadata.gems_course_code = product_code;
    }
    const { error: updErr } = await service
      .from("courses")
      .update({ metadata, updated_at: new Date().toISOString() })
      .eq("id", course_id);
    if (updErr) {
      results.push({ course_id, ok: false, error: updErr.message });
    } else {
      results.push({ course_id, ok: true });
    }
  }

  return NextResponse.json({
    updated: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
  });
}
