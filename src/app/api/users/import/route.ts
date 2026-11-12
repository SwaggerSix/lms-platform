import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/auth/authorize";
import { canAssignRole } from "@/lib/auth/roles";
import { createServiceClient } from "@/lib/supabase/service";
import { validateBody, createUserSchema } from "@/lib/validations";
import { createUserAccount } from "@/lib/users/create-user";
import { resolveTenantForUser, isFeatureEnabled } from "@/lib/tenants/tenant-queries";
import { sendAccountInvite } from "@/lib/users/invite-email";
import { appBaseUrl } from "@/lib/users/set-password-link";
import { IMPORT_MAX_ROWS as MAX_ROWS, IMPORT_MAX_ROWS_WITH_INVITES as MAX_ROWS_WITH_INVITES } from "@/lib/users/import-limits";

// Rows are created one at a time, and emailing an invitation adds a link and
// a send per row, so allow a 5-minute run (as other long routes here do) and
// keep emailed batches smaller.
export const maxDuration = 300;

// Minimum gap between invitation emails, to stay well inside the email
// provider's per-second rate limit.
const INVITE_SPACING_MS = 500;
const INVITE_RETRY_DELAY_MS = 1500;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface RowResult {
  row: number;
  email: string;
  status: "created" | "failed";
  error?: string;
  /** An invitation with a set-password link was emailed. */
  emailed?: boolean;
  /** Set when an invitation was wanted but the email failed: share it by hand. */
  invite_link?: string;
  /** Only returned when no invitation was emailed (opted out, user-ID account, or the email failed). */
  temporary_password?: string;
}

/**
 * POST /api/users/import — bulk-create users from parsed CSV rows.
 * Body: { users: Array<{ first_name, last_name, email, role?, job_title?,
 *         organization_id?, manager_id? }>, send_invite?: boolean }
 *
 * Each row is validated and created independently; one bad row never aborts the
 * batch. Like Admin → Users → Add user, each email account is emailed an
 * invitation with a set-password link unless send_invite is false. Rows that
 * weren't emailed (opted out, user-ID accounts, or a failed send) come back
 * with their temporary password so the admin can distribute credentials.
 */
export async function POST(request: NextRequest) {
  const auth = await authorize("admin");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const rows = body?.users;
  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: "Provide a non-empty 'users' array" }, { status: 400 });
  }
  if (rows.length > MAX_ROWS) {
    return NextResponse.json(
      { error: `Too many rows: ${rows.length}. Import at most ${MAX_ROWS} at a time.` },
      { status: 400 }
    );
  }
  const sendInvites = body?.send_invite !== false;
  if (sendInvites && rows.length > MAX_ROWS_WITH_INVITES) {
    return NextResponse.json(
      {
        error: `Too many rows to email at once: ${rows.length}. Import at most ${MAX_ROWS_WITH_INVITES} at a time with invitations, or untick the invitation box.`,
      },
      { status: 400 }
    );
  }

  const service = createServiceClient();
  const results: RowResult[] = [];
  const base = appBaseUrl(request.url);

  let inviterName: string | undefined;
  if (sendInvites) {
    const { data: me } = await service
      .from("users")
      .select("first_name, last_name")
      .eq("id", auth.user.id)
      .maybeSingle();
    inviterName = [me?.first_name, me?.last_name].filter(Boolean).join(" ").trim() || undefined;
  }
  let lastSendAt = 0;
  const invite = async (user: { email: string; first_name?: string | null }) => {
    const wait = lastSendAt + INVITE_SPACING_MS - Date.now();
    if (wait > 0) await sleep(wait);
    let result = await sendAccountInvite(service, user, base, inviterName);
    if (!result.emailed) {
      // Most often a momentary rate limit: one retry after a pause. A retry
      // makes a fresh link, which replaces the first one.
      await sleep(INVITE_RETRY_DELAY_MS);
      result = await sendAccountInvite(service, user, base, inviterName);
    }
    lastSendAt = Date.now();
    return result;
  };

  // Pseudonymous (login ID) rows are a per-tenant opt-in; resolve the flag
  // once for the whole batch.
  const hasLoginIdRows = rows.some((r) => r && typeof r.login_id === "string" && r.login_id.trim());
  let userIdLoginsEnabled = false;
  if (hasLoginIdRows) {
    const tenantId = await resolveTenantForUser(auth.user.id, auth.user.role, request);
    userIdLoginsEnabled = await isFeatureEnabled(tenantId, "user_id_logins");
  }

  // Reject duplicate emails/login IDs within the batch up front so both copies
  // don't race to create the same auth account.
  const seenEmails = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 1;
    const raw = rows[i] ?? {};
    const email = typeof raw.email === "string" ? raw.email.trim() : "";

    const validation = validateBody(createUserSchema, {
      ...raw,
      email: email || undefined,
      login_id: typeof raw.login_id === "string" && raw.login_id.trim() ? raw.login_id.trim() : undefined,
      first_name: typeof raw.first_name === "string" ? raw.first_name.trim() || undefined : raw.first_name,
      last_name: typeof raw.last_name === "string" ? raw.last_name.trim() || undefined : raw.last_name,
    });
    if (!validation.success) {
      results.push({ row: rowNum, email, status: "failed", error: validation.error });
      continue;
    }

    if (validation.data.login_id && !userIdLoginsEnabled) {
      results.push({
        row: rowNum,
        email: validation.data.login_id,
        status: "failed",
        error: "User ID logins are not enabled for this tenant",
      });
      continue;
    }

    const identifier = (validation.data.email ?? validation.data.login_id ?? "").toLowerCase();
    if (seenEmails.has(identifier)) {
      results.push({ row: rowNum, email: email || identifier, status: "failed", error: "Duplicate email or login ID in file" });
      continue;
    }
    seenEmails.add(identifier);

    if (validation.data.role && !canAssignRole(auth.user.role, validation.data.role)) {
      results.push({
        row: rowNum,
        email,
        status: "failed",
        error: "You are not allowed to assign that role",
      });
      continue;
    }

    const created = await createUserAccount(service, validation.data, auth.user.id);
    if (!created.ok) {
      results.push({ row: rowNum, email, status: "failed", error: created.error });
      continue;
    }

    // For pseudonymous accounts the login ID is the credential the admin
    // hands out, not the synthetic email behind it.
    const shownAs = created.user.login_id || created.user.email;

    if (sendInvites && !created.user.login_id) {
      const sent = await invite(created.user as { email: string; first_name?: string | null });
      results.push(
        sent.emailed
          ? { row: rowNum, email: shownAs, status: "created", emailed: true }
          : {
              row: rowNum,
              email: shownAs,
              status: "created",
              emailed: false,
              ...(sent.link ? { invite_link: sent.link } : {}),
              temporary_password: created.temporaryPassword,
            }
      );
      continue;
    }

    results.push({
      row: rowNum,
      email: shownAs,
      status: "created",
      emailed: false,
      temporary_password: created.temporaryPassword,
    });
  }

  const createdCount = results.filter((r) => r.status === "created").length;
  const emailedCount = results.filter((r) => r.emailed).length;
  return NextResponse.json({
    total: rows.length,
    created: createdCount,
    emailed: emailedCount,
    failed: rows.length - createdCount,
    results,
  });
}
