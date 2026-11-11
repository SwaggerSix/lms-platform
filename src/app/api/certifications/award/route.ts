import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authorize } from "@/lib/auth/authorize";
import { createServiceClient } from "@/lib/supabase/service";
import { rateLimit } from "@/lib/rate-limit";
import { awardCertification, revokeCertification } from "@/lib/certifications/issue";

/**
 * Staff-awarded credentials (e.g. "Mosaic Certified"): who holds one, who is
 * ready for one, award, revoke. Admins only. An org admin acts only on
 * learners in their own organization; a super admin on anyone.
 */

const DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date (YYYY-MM-DD)");

const AwardSchema = z.object({
  certification_id: z.string().uuid(),
  user_id: z.string().uuid(),
  memo_passed_on: DATE,
  briefing_passed_on: DATE,
  note: z.string().max(1000).optional(),
});

type Auth = { user: { id: string; role: string; organization_id: string | null } };

async function learnerInScope(service: ReturnType<typeof createServiceClient>, auth: Auth, userId: string) {
  if (auth.user.role === "super_admin") return true;
  const { data } = await service.from("users").select("organization_id").eq("id", userId).maybeSingle();
  return !!data && !!auth.user.organization_id && data.organization_id === auth.user.organization_id;
}

function fullName(u: { first_name?: string | null; last_name?: string | null; email?: string | null } | null) {
  if (!u) return "Unknown";
  return `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim() || u.email || "Unknown";
}

export async function GET(request: NextRequest) {
  const auth = await authorize("admin");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const service = createServiceClient();

  const id = new URL(request.url).searchParams.get("certification_id");
  if (!id || !z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "certification_id is required" }, { status: 400 });
  }

  const { data: cert } = await service
    .from("certifications")
    .select("id, name, course_id, status, award_requires_course_id")
    .eq("id", id)
    .maybeSingle();
  if (!cert) return NextResponse.json({ error: "Certification not found" }, { status: 404 });
  if (cert.course_id) {
    return NextResponse.json({ error: "Issued automatically on course completion" }, { status: 400 });
  }

  const scopeOrg = auth.user.role === "super_admin" ? null : auth.user.organization_id;

  // Name the foreign key in each embed: enrollments has two keys to users
  // (user_id, assigned_by), and an ambiguous embed fails the whole query.
  const { data: held, error: heldError } = await service
    .from("user_certifications")
    .select("id, user_id, status, issued_at, expires_at, metadata, user:users!user_certifications_user_id_fkey(first_name, last_name, email, organization_id)")
    .eq("certification_id", id)
    .order("issued_at", { ascending: false })
    .limit(500);
  if (heldError) {
    console.error("Award list error:", heldError.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  const holders = (held ?? [])
    .filter((r: any) => !scopeOrg || r.user?.organization_id === scopeOrg)
    .map((r: any) => ({
      id: r.id,
      userId: r.user_id,
      name: fullName(r.user),
      email: r.user?.email ?? "",
      status: r.status,
      issuedAt: r.issued_at,
      expiresAt: r.expires_at,
      memoPassedOn: r.metadata?.memo_passed_on ?? null,
      briefingPassedOn: r.metadata?.briefing_passed_on ?? null,
    }));
  const activeHolders = new Set(holders.filter((h) => h.status === "active").map((h) => h.userId));

  // Ready = completed the required course, not already an active holder.
  let ready: { userId: string; name: string; email: string; completedAt: string | null }[] = [];
  if (cert.award_requires_course_id) {
    const { data: done, error: doneError } = await service
      .from("enrollments")
      .select("user_id, completed_at, user:users!enrollments_user_id_fkey(first_name, last_name, email, organization_id)")
      .eq("course_id", cert.award_requires_course_id)
      .eq("status", "completed")
      .order("completed_at", { ascending: false })
      .limit(500);
    if (doneError) {
      console.error("Award list error:", doneError.message);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
    const seen = new Set<string>();
    ready = (done ?? [])
      .filter((r: any) => !scopeOrg || r.user?.organization_id === scopeOrg)
      .filter((r: any) => !activeHolders.has(r.user_id) && !seen.has(r.user_id) && seen.add(r.user_id))
      .map((r: any) => ({
        userId: r.user_id,
        name: fullName(r.user),
        email: r.user?.email ?? "",
        completedAt: r.completed_at,
      }));
  }

  return NextResponse.json({ certification: { id: cert.id, name: cert.name }, holders, ready });
}

export async function POST(request: NextRequest) {
  const auth = await authorize("admin");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const rl = await rateLimit(`cert-award-${auth.user.id}`, 30, 60000);
  if (!rl.success) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });

  const parsed = AwardSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 });
  }
  const body = parsed.data;
  const service = createServiceClient();

  if (!(await learnerInScope(service, auth as Auth, body.user_id))) {
    return NextResponse.json({ error: "Learner not found" }, { status: 404 });
  }

  const result = await awardCertification(service, {
    certificationId: body.certification_id,
    userId: body.user_id,
    awardedBy: auth.user.id,
    memoPassedOn: body.memo_passed_on,
    briefingPassedOn: body.briefing_passed_on,
    note: body.note,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(
    { user_certification_id: result.userCertificationId, reawarded: result.reawarded },
    { status: result.reawarded ? 200 : 201 }
  );
}

export async function DELETE(request: NextRequest) {
  const auth = await authorize("admin");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const id = new URL(request.url).searchParams.get("id");
  if (!id || !z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }
  const service = createServiceClient();

  const { data: row } = await service
    .from("user_certifications")
    .select("user_id, certification:certifications(course_id)")
    .eq("id", id)
    .maybeSingle();
  if (!row || !(await learnerInScope(service, auth as Auth, row.user_id))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if ((row.certification as any)?.course_id) {
    return NextResponse.json({ error: "Course-completion certificates can't be revoked here" }, { status: 400 });
  }

  const result = await revokeCertification(service, { userCertificationId: id, revokedBy: auth.user.id });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true });
}
