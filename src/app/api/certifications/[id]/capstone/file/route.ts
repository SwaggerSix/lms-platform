import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authorize } from "@/lib/auth/authorize";
import { createServiceClient } from "@/lib/supabase/service";
import { signedFileUrl } from "@/lib/certifications/capstone-service";

/**
 * GET ?submission_id=…[&position=n]: redirect to a 10-minute link to a handed-in
 * file (or a pushback answer). The learner who handed it in, or an admin in
 * scope (super admin: anyone; org admin: their organization).
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await authorize("admin", "manager", "instructor", "learner");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const sp = new URL(request.url).searchParams;
  const subId = sp.get("submission_id") ?? "";
  const pos = sp.get("position");
  if (!z.string().uuid().safeParse(subId).success || !z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const service = createServiceClient();
  const { data: sub } = await service
    .from("certification_submissions")
    .select("id, user_id, certification_id, file_path, file_name, user:users!certification_submissions_user_id_fkey(organization_id)")
    .eq("id", subId)
    .maybeSingle();
  if (!sub || sub.certification_id !== id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const own = sub.user_id === auth.user.id;
  const isAdmin =
    auth.user.role === "super_admin" ||
    (auth.user.role === "admin" &&
      !!auth.user.organization_id &&
      (sub.user as { organization_id?: string | null } | null)?.organization_id === auth.user.organization_id);
  if (!own && !isAdmin) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let path = sub.file_path as string | null;
  let name = sub.file_name ?? undefined;
  if (pos) {
    const n = Number(pos);
    if (![1, 2, 3].includes(n)) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const { data: pb } = await service
      .from("certification_pushback_answers")
      .select("file_path")
      .eq("submission_id", sub.id)
      .eq("position", n)
      .maybeSingle();
    path = pb?.file_path ?? null;
    name = undefined;
  }
  if (!path) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const url = await signedFileUrl(service, path, name);
  if (!url) return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  return NextResponse.redirect(url, 302);
}
