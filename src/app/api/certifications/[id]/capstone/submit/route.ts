import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit } from "@/lib/rate-limit";
import { learnerContext } from "../_shared";
import { submitPiece } from "@/lib/certifications/capstone-service";

const Schema = z.object({
  kind: z.enum(["memo", "briefing", "practical"]),
  path: z.string().min(1).max(500).optional(),
  file_name: z.string().max(300).optional(),
  link: z.string().max(2000).optional(),
  note: z.string().max(2000).optional(),
});

/** POST: hand in the memo or the briefing (an uploaded file's path, or a link to the recording). */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await learnerContext(id);
  if ("res" in ctx) return ctx.res;
  const rl = await rateLimit(`capstone-submit-${ctx.auth.user.id}`, 10, 60000);
  if (!rl.success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const b = parsed.data;
  const r = await submitPiece(ctx.service, {
    userId: ctx.auth.user.id,
    cert: ctx.cert,
    cfg: ctx.cfg,
    kind: b.kind,
    filePath: b.path,
    fileName: b.file_name,
    link: b.link?.trim() || undefined,
    note: b.note,
  });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ submission_id: r.submissionId, attempt: r.attempt }, { status: 201 });
}
