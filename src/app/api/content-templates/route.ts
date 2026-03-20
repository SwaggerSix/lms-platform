import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/auth/authorize";
import { createServiceClient } from "@/lib/supabase/service";
import { rateLimit } from "@/lib/rate-limit";
import { z } from "zod";
import { validateBody } from "@/lib/validations";

const createTemplateSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  blocks: z.array(z.record(z.string(), z.unknown())),
  category: z.string().max(100).optional(),
  is_system: z.boolean().default(false),
});

export async function GET(request: NextRequest) {
  const auth = await authorize("admin", "instructor");
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");

  const service = createServiceClient();
  let query = service
    .from("content_templates")
    .select("*")
    .order("created_at", { ascending: false });

  if (category) {
    query = query.eq("category", category);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Content templates GET error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ templates: data });
}

export async function POST(request: NextRequest) {
  const auth = await authorize("admin", "instructor");
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const rl = await rateLimit(`content-templates-create:${auth.user.id}`, 20, 60000);
  if (!rl.success) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const body = await request.json();
  const validation = validateBody(createTemplateSchema, body);
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const service = createServiceClient();
  const { data, error } = await service
    .from("content_templates")
    .insert({
      name: validation.data.name,
      description: validation.data.description || null,
      blocks: validation.data.blocks,
      category: validation.data.category || null,
      is_system: validation.data.is_system,
      created_by: auth.user.id,
    })
    .select()
    .single();

  if (error) {
    console.error("Content templates POST error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ template: data }, { status: 201 });
}
