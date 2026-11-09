import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authorize } from "@/lib/auth/authorize";
import { getEffectivePermissionsForUser } from "@/lib/auth/authorize-permission";
import { createServiceClient } from "@/lib/supabase/service";
import { rateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { sendEmail } from "@/lib/email/sender";
import { learningPathAccess } from "@/lib/email/templates";
import { createUserAccount } from "@/lib/users/create-user";
import { grantPathAccess, MAX_PATH_INVITES, parseInviteList, type Invitee } from "@/lib/paths/invite";

/**
 * POST /api/paths/[id]/invite
 * Body: { text: string }  — pasted addresses, optionally with names.
 *
 * Admin → Learning Paths → "Invite people". For each address:
 *  - an existing account is enrolled in the path and every course on it and
 *    emailed a link to the path;
 *  - a new address gets an account the way Admin → Users does
 *    (createUserAccount: auth user + users row, must set a password), is
 *    enrolled, and is emailed the set-password (recovery) link — the same
 *    mechanism as "Resend invite".
 * Someone who already had the path is left as they are (no email).
 *
 * Permissions follow the path "Assign" feature (/api/paths/enroll): admins
 * and super admins can invite anyone; managers only their own direct reports,
 * and only admins (with users.manage) can create new accounts. This is an
 * admin action, so it may hand out a path that is sold in the store.
 */

const bodySchema = z.object({ text: z.string().min(1).max(50_000) });

type RowStatus = "invited" | "added" | "already" | "failed";
interface RowResult {
  email: string;
  status: RowStatus;
  reason?: string;
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorize("admin", "manager");
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const actor = auth.user;
  const isPrivileged = actor.role === "admin" || actor.role === "super_admin";

  const rl = await rateLimit(`path-invite-${actor.id}`, 5, 60000);
  if (!rl.success) {
    return NextResponse.json({ error: "Too many invites at once. Please wait a minute." }, { status: 429 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Paste at least one email address." }, { status: 400 });
  }
  const { invitees, invalid } = parseInviteList(parsed.data.text);
  if (invitees.length === 0) {
    return NextResponse.json({ error: "No email addresses found." }, { status: 400 });
  }
  if (invitees.length > MAX_PATH_INVITES) {
    return NextResponse.json(
      { error: `You can invite up to ${MAX_PATH_INVITES} people at a time (this list has ${invitees.length}).` },
      { status: 400 }
    );
  }

  const { id: pathId } = await params;
  const service = createServiceClient();

  const { data: path } = await service
    .from("learning_paths")
    .select("id, title, slug, status")
    .eq("id", pathId)
    .maybeSingle();
  if (!path) {
    return NextResponse.json({ error: "Learning path not found" }, { status: 404 });
  }
  if (path.status !== "published") {
    return NextResponse.json({ error: "Publish the learning path before inviting people." }, { status: 400 });
  }

  const { data: items } = await service
    .from("learning_path_items")
    .select("course_id, sequence_order")
    .eq("path_id", pathId)
    .order("sequence_order", { ascending: true });
  const courseIds = [
    ...new Set(((items as { course_id: string | null }[] | null) || []).map((i) => i.course_id).filter((c): c is string => Boolean(c))),
  ];

  // Creating accounts is what Admin → Users → Add user allows: admins whose
  // role keeps users.manage.
  const canCreateAccounts =
    isPrivileged &&
    (actor.role === "super_admin" || (await getEffectivePermissionsForUser(actor)).includes("users.manage"));

  const { data: me } = await service
    .from("users")
    .select("first_name, last_name")
    .eq("id", actor.id)
    .maybeSingle();
  const inviterName = [me?.first_name, me?.last_name].filter(Boolean).join(" ").trim() || undefined;

  const base = (process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin).replace(/\/$/, "");
  const pathUrl = path.slug ? `${base}/learn/paths/${path.slug}` : `${base}/learn/paths`;

  const results: RowResult[] = [];
  for (const invitee of invitees) {
    try {
      results.push(
        await inviteOne(invitee, {
          service,
          actorId: actor.id,
          isPrivileged,
          canCreateAccounts,
          path: { id: path.id, title: path.title },
          courseIds,
          pathUrl,
          base,
          inviterName,
        })
      );
    } catch (err) {
      console.error("Path invite failed for an address:", err instanceof Error ? err.message : err);
      results.push({ email: invitee.email, status: "failed", reason: "Something went wrong. Try again." });
    }
  }
  for (const piece of invalid) {
    results.push({ email: piece.slice(0, 120), status: "failed", reason: "Not an email address" });
  }

  const summary = {
    invited: results.filter((r) => r.status === "invited").length,
    added: results.filter((r) => r.status === "added").length,
    already: results.filter((r) => r.status === "already").length,
    failed: results.filter((r) => r.status === "failed").length,
  };

  logAudit({
    userId: actor.id,
    action: "created",
    entityType: "learning_path_invite",
    entityId: path.id,
    newValues: { path_title: path.title, ...summary },
  });

  return NextResponse.json({ summary, results });
}

async function inviteOne(
  invitee: Invitee,
  ctx: {
    service: ReturnType<typeof createServiceClient>;
    actorId: string;
    isPrivileged: boolean;
    canCreateAccounts: boolean;
    path: { id: string; title: string };
    courseIds: string[];
    pathUrl: string;
    base: string;
    inviterName?: string;
  }
): Promise<RowResult> {
  const { service } = ctx;
  const email = invitee.email;

  const { data: existing } = await service
    .from("users")
    .select("id, email, first_name, status, manager_id, login_id")
    .ilike("email", escapeLike(email))
    .limit(1)
    .maybeSingle();

  if (existing) {
    if (existing.status !== "active") {
      return { email, status: "failed", reason: "This account is deactivated" };
    }
    if (!ctx.isPrivileged && existing.manager_id !== ctx.actorId) {
      return { email, status: "failed", reason: "Not one of your team members" };
    }
    const outcome = await grantPathAccess(service, {
      userId: existing.id,
      pathId: ctx.path.id,
      courseIds: ctx.courseIds,
      assignedBy: ctx.actorId,
    });
    if (outcome === "error") return { email, status: "failed", reason: "Could not enroll" };
    if (outcome === "already") return { email, status: "already" };

    const tpl = learningPathAccess({
      name: existing.first_name || invitee.firstName || "there",
      pathTitle: ctx.path.title,
      courseCount: ctx.courseIds.length,
      actionUrl: ctx.pathUrl,
      isNewAccount: false,
      inviterName: ctx.inviterName,
    });
    const sent = await sendEmail({ to: existing.email, subject: tpl.subject, html: tpl.html, text: tpl.text });
    if (!sent.success) console.error("Path access email failed:", sent.error);
    return { email, status: "added", ...(sent.success ? {} : { reason: "Enrolled, but the email didn't send" }) };
  }

  if (!ctx.canCreateAccounts) {
    return { email, status: "failed", reason: "No account yet — only an admin can invite new people" };
  }

  const firstName = invitee.firstName || email.split("@")[0];
  const created = await createUserAccount(
    service,
    { email, first_name: firstName, last_name: invitee.lastName || "", role: "learner", status: "active" },
    ctx.actorId
  );
  if (!created.ok) {
    return {
      email,
      status: "failed",
      reason:
        created.status === 409
          ? "A sign-in for this address exists but isn't set up in the LMS — contact support"
          : "Could not create the account",
    };
  }
  const userId = created.user.id as string;

  const outcome = await grantPathAccess(service, {
    userId,
    pathId: ctx.path.id,
    courseIds: ctx.courseIds,
    assignedBy: ctx.actorId,
  });
  if (outcome === "error") {
    return { email, status: "failed", reason: "Account created, but enrolling failed — use Assign" };
  }

  // Same set-password link as Admin → Users → Resend invite.
  const { data: link, error: linkErr } = await service.auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo: `${ctx.base}/reset-password` },
  });
  const actionUrl = link?.properties?.action_link;
  if (linkErr || !actionUrl) {
    console.error("Path invite link error:", linkErr?.message);
    return { email, status: "invited", reason: "Enrolled, but no email was sent — use Resend invite under Users" };
  }
  const tpl = learningPathAccess({
    name: firstName,
    pathTitle: ctx.path.title,
    courseCount: ctx.courseIds.length,
    actionUrl,
    isNewAccount: true,
    inviterName: ctx.inviterName,
  });
  const sent = await sendEmail({ to: email, subject: tpl.subject, html: tpl.html, text: tpl.text });
  if (!sent.success) console.error("Path invite email failed:", sent.error);
  return {
    email,
    status: "invited",
    ...(sent.success ? {} : { reason: "Enrolled, but the email didn't send — use Resend invite under Users" }),
  };
}
