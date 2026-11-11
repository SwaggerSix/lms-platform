import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authorize } from "@/lib/auth/authorize";
import { createServiceClient } from "@/lib/supabase/service";
import { rateLimit } from "@/lib/rate-limit";
import { reopenPiece } from "@/lib/certifications/capstone-service";

const Schema = z.object({
  submission_id: z.string().uuid(),
  note: z.string().max(2000).optional(),
});

/**
 * POST: after the call, reopen a capstone piece the learner failed twice so
 * they can hand it in once more. Admins in scope; the learner is emailed.
 */
export async function POST(request: NextRequest) {
  const auth = await authorize("admin");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const rl = await rateLimit(`capstone-reopen-${auth.user.id}`, 30, 60000);
  if (!rl.success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const service = createServiceClient();

  const { data: sub } = await service
    .from("certification_submissions")
    .select("user:users!certification_submissions_user_id_fkey(organization_id)")
    .eq("id", parsed.data.submission_id)
    .maybeSingle();
  const org = (sub?.user as { organization_id?: string | null } | null)?.organization_id ?? null;
  const inScope = auth.user.role === "super_admin" || (!!auth.user.organization_id && org === auth.user.organization_id);
  if (!sub || !inScope) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const r = await reopenPiece(service, {
    submissionId: parsed.data.submission_id,
    reopenedBy: auth.user.id,
    note: parsed.data.note,
  });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ ok: true });
}
