import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/auth/authorize";
import { canAssignRole } from "@/lib/auth/roles";
import { createServiceClient } from "@/lib/supabase/service";
import { validateBody, createUserSchema } from "@/lib/validations";
import { createUserAccount } from "@/lib/users/create-user";

const MAX_ROWS = 500;

interface RowResult {
  row: number;
  email: string;
  status: "created" | "failed";
  error?: string;
  temporary_password?: string;
}

/**
 * POST /api/users/import — bulk-create users from parsed CSV rows.
 * Body: { users: Array<{ first_name, last_name, email, role?, job_title?,
 *         organization_id?, manager_id? }> }
 *
 * Each row is validated and created independently; one bad row never aborts the
 * batch. Returns a per-row summary including the temporary password for each
 * created user so the admin can distribute credentials.
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

  const service = createServiceClient();
  const results: RowResult[] = [];

  // Reject duplicate emails within the batch up front so both copies don't race
  // to create the same auth account.
  const seenEmails = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 1;
    const raw = rows[i] ?? {};
    const email = typeof raw.email === "string" ? raw.email.trim() : "";

    const validation = validateBody(createUserSchema, {
      ...raw,
      email,
      first_name: typeof raw.first_name === "string" ? raw.first_name.trim() : raw.first_name,
      last_name: typeof raw.last_name === "string" ? raw.last_name.trim() : raw.last_name,
    });
    if (!validation.success) {
      results.push({ row: rowNum, email, status: "failed", error: validation.error });
      continue;
    }

    const normalizedEmail = validation.data.email.toLowerCase();
    if (seenEmails.has(normalizedEmail)) {
      results.push({ row: rowNum, email, status: "failed", error: "Duplicate email in file" });
      continue;
    }
    seenEmails.add(normalizedEmail);

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

    results.push({
      row: rowNum,
      email: created.user.email,
      status: "created",
      temporary_password: created.temporaryPassword,
    });
  }

  const createdCount = results.filter((r) => r.status === "created").length;
  return NextResponse.json({
    total: rows.length,
    created: createdCount,
    failed: rows.length - createdCount,
    results,
  });
}
