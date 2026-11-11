import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authorize } from "@/lib/auth/authorize";
import { createServiceClient } from "@/lib/supabase/service";

const Schema = z.object({ certification_id: z.string().uuid(), on: z.boolean() });

/** PUT: the signed-in admin's "Email me when work is handed in" box for one credential. */
export async function PUT(request: NextRequest) {
  const auth = await authorize("admin");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const service = createServiceClient();
  const { data: cert } = await service
    .from("certifications")
    .select("id, notify_user_ids")
    .eq("id", parsed.data.certification_id)
    .maybeSingle();
  if (!cert) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const ids = new Set<string>(cert.notify_user_ids ?? []);
  if (parsed.data.on) ids.add(auth.user.id);
  else ids.delete(auth.user.id);
  const { error } = await service
    .from("certifications")
    .update({ notify_user_ids: [...ids] })
    .eq("id", cert.id);
  if (error) {
    console.error("Notify toggle error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, on: parsed.data.on });
}
