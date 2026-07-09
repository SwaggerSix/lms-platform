import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { logAudit } from "@/lib/audit";
import {
  VIEW_AS_COOKIE,
  canUseViewAs,
  previewableRoles,
  resolveViewAsRole,
} from "@/lib/auth/view-as";
import type { UserRole } from "@/types/database";

/**
 * Read-only role preview (§2.12).
 *
 * GET    — report the caller's real role, the role they're currently previewing
 *          (if any), and the roles they may preview. Drives the header switcher
 *          and the preview banner.
 * POST    { role } — start previewing `role`. Admins/Super Admins only.
 * DELETE  — stop previewing (clear the cookie).
 *
 * Every start/stop is written to the audit log. This route is exempt from the
 * middleware's read-only mutation block so a preview can always be exited.
 */

async function getRealRole(): Promise<{ userId: string; role: string } | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const service = createServiceClient();
  const { data } = await service
    .from("users")
    .select("id, role")
    .eq("auth_id", user.id)
    .single();

  if (!data) return null;
  return { userId: data.id, role: data.role };
}

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    // Preview is a transient tool — expire after the working day so a stray
    // cookie can't silently keep an admin in preview mode forever.
    maxAge: 60 * 60 * 12,
  };
}

export async function GET(request: NextRequest) {
  const actor = await getRealRole();
  if (!actor) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const cookieValue = request.cookies.get(VIEW_AS_COOKIE)?.value ?? null;
  const viewingAs = resolveViewAsRole(actor.role, cookieValue);

  return NextResponse.json({
    realRole: actor.role,
    viewingAs,
    canUseViewAs: canUseViewAs(actor.role),
    previewableRoles: previewableRoles(actor.role),
  });
}

export async function POST(request: NextRequest) {
  const actor = await getRealRole();
  if (!actor) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (!canUseViewAs(actor.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { role?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const target = body.role as UserRole | undefined;
  if (!target || !previewableRoles(actor.role).includes(target)) {
    return NextResponse.json(
      { error: "You cannot preview that role." },
      { status: 400 }
    );
  }

  const res = NextResponse.json({ ok: true, viewingAs: target });
  res.cookies.set(VIEW_AS_COOKIE, target, cookieOptions());

  await logAudit({
    userId: actor.userId,
    action: "view_as_start",
    entityType: "role_preview",
    entityId: target,
    newValues: { previewing_role: target },
    ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
  });

  return res;
}

export async function DELETE(request: NextRequest) {
  const actor = await getRealRole();
  if (!actor) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const previous = resolveViewAsRole(
    actor.role,
    request.cookies.get(VIEW_AS_COOKIE)?.value ?? null
  );

  const res = NextResponse.json({ ok: true });
  res.cookies.set(VIEW_AS_COOKIE, "", { ...cookieOptions(), maxAge: 0 });

  if (previous) {
    await logAudit({
      userId: actor.userId,
      action: "view_as_stop",
      entityType: "role_preview",
      entityId: previous,
      oldValues: { previewing_role: previous },
      ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
    });
  }

  return res;
}
