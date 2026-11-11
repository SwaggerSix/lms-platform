import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit } from "@/lib/rate-limit";
import { learnerContext } from "../_shared";
import { answerPushback, revealPushback } from "@/lib/certifications/capstone-service";

const Schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("reveal"), submission_id: z.string().uuid(), position: z.number().int().min(1).max(3) }),
  z.object({
    action: z.literal("answer"),
    submission_id: z.string().uuid(),
    position: z.number().int().min(1).max(3),
    path: z.string().min(1).max(500),
    recorded_in_browser: z.boolean(),
  }),
]);

/** POST: show a pushback question (starts its clock, once) or hand in the recorded answer. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await learnerContext(id);
  if ("res" in ctx) return ctx.res;
  const rl = await rateLimit(`capstone-pushback-${ctx.auth.user.id}`, 30, 60000);
  if (!rl.success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const b = parsed.data;
  if (b.action === "reveal") {
    const r = await revealPushback(ctx.service, {
      userId: ctx.auth.user.id, cert: ctx.cert, cfg: ctx.cfg, submissionId: b.submission_id, position: b.position,
    });
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    return NextResponse.json({ prompt: r.prompt, revealed_at: r.revealedAt });
  }
  const r = await answerPushback(ctx.service, {
    userId: ctx.auth.user.id, cert: ctx.cert, submissionId: b.submission_id, position: b.position,
    filePath: b.path, recordedInBrowser: b.recorded_in_browser,
  });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ ok: true });
}
