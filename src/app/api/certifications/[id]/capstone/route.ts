import { NextRequest, NextResponse } from "next/server";
import { learnerContext } from "./_shared";
import { submissionsFor } from "@/lib/certifications/capstone-service";
import { latestOf, nextAttempt } from "@/lib/certifications/capstone";

/** GET: the learner's own capstone — tasks, what they've handed in, marks, and pushback state. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await learnerContext(id);
  if ("res" in ctx) return ctx.res;
  const { auth, service, cert, cfg } = ctx;

  let data;
  try {
    data = await submissionsFor(service, cert.id, [auth.user.id]);
  } catch (e) {
    console.error("Capstone load error:", (e as Error).message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
  const { subs, pushback } = data;
  const pbPiece = cfg.pieces.find((p) => p.pushback);
  const pbSub = pbPiece ? latestOf(subs, pbPiece.kind) : null;
  const pb = pbSub ? pushback.filter((p) => p.submission_id === pbSub.id) : [];

  const { data: held } = await service
    .from("user_certifications")
    .select("status")
    .eq("user_id", auth.user.id)
    .eq("certification_id", cert.id)
    .maybeSingle();

  return NextResponse.json({
    certification: { id: cert.id, name: cert.name },
    config: {
      title: cfg.title,
      intro: cfg.intro,
      turnaround: cfg.turnaround,
      pieces: cfg.pieces.map((p) => ({
        kind: p.kind,
        title: p.title,
        instructions: p.instructions,
        file: p.file,
        link: p.link,
        linkLabel: p.linkLabel ?? null,
        requiredNote: p.requiredNote ?? null,
        warning: p.warning ?? null,
      })),
      pushback: cfg.pushback
        ? { count: cfg.pushback.count, prepSeconds: cfg.pushback.prepSeconds, answerSeconds: cfg.pushback.answerSeconds }
        : null,
    },
    certified: held?.status === "active",
    submissions: subs.map((s) => ({
      id: s.id, kind: s.kind, attempt: s.attempt, status: s.status, submittedAt: s.submitted_at,
      fileName: s.file_name, hasFile: !!s.file_path, link: s.link_url, reviewedAt: s.reviewed_at, feedback: s.feedback,
      reopenedAt: s.reopened_at ?? null,
    })),
    next: Object.fromEntries(cfg.pieces.map((p) => [p.kind, nextAttempt(subs, p.kind)])),
    pushback:
      pbSub && cfg.pushback
        ? {
            submissionId: pbSub.id,
            open: pbSub.status === "submitted",
            questions: pb.map((p) => ({
              position: p.position,
              revealedAt: p.revealed_at,
              answered: !!p.answered_at,
              // Never send a question before it is shown: the draw is the point.
              prompt: p.revealed_at ? cfg.pushback!.bank[p.prompt_index] : null,
            })),
          }
        : null,
  });
}
