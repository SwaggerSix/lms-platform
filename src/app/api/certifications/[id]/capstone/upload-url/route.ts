import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit } from "@/lib/rate-limit";
import { learnerContext } from "../_shared";
import { startUpload } from "@/lib/certifications/capstone-service";

const Schema = z.object({
  slot: z.enum(["memo", "briefing", "pushback"]),
  file_size: z.number().int().positive(),
  content_type: z.string().min(1).max(200),
});

/** POST: a one-time signed URL the browser sends the file straight to (Vercel caps request bodies at ~4.5 MB). */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await learnerContext(id);
  if ("res" in ctx) return ctx.res;
  const rl = await rateLimit(`capstone-upload-${ctx.auth.user.id}`, 20, 60000);
  if (!rl.success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const r = await startUpload(ctx.service, {
    userId: ctx.auth.user.id,
    certificationId: ctx.cert.id,
    slot: parsed.data.slot,
    fileSize: parsed.data.file_size,
    contentType: parsed.data.content_type,
  });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ path: r.path, signedUrl: r.signedUrl });
}
