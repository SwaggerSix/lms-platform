import { createServiceClient } from "@/lib/supabase/service";
import { dispatchWebhook } from "@/lib/webhooks/dispatcher";
import { logAudit } from "@/lib/audit";
import { processRulesForUser } from "@/lib/automation/rules-engine";
import crypto from "crypto";

// 16 bytes base64url ≈ 22 chars; Supabase requires ≥6.
export function generateTemporaryPassword(): string {
  return crypto.randomBytes(16).toString("base64url");
}

const ALLOWED_FIELDS = [
  "first_name",
  "last_name",
  "email",
  "role",
  "job_title",
  "organization_id",
  "manager_id",
  "status",
  "hire_date",
];

export interface CreateUserOk {
  ok: true;
  user: Record<string, any>;
  temporaryPassword: string;
}
export interface CreateUserErr {
  ok: false;
  error: string;
  status: number;
}
export type CreateUserResult = CreateUserOk | CreateUserErr;

/**
 * Create a login-capable user: a Supabase auth account (with a temporary
 * password and forced reset) plus the users row, then fire the webhook, audit
 * log, and automation rules. Shared by the single-user POST and the bulk CSV
 * import so both paths behave identically.
 *
 * The caller is responsible for role authorization (canAssignRole) before
 * calling this — `data` is expected to be already validated.
 */
export async function createUserAccount(
  service: ReturnType<typeof createServiceClient>,
  data: Record<string, unknown>,
  actingUserId: string
): Promise<CreateUserResult> {
  const email = String(data.email ?? "");
  const sanitized = Object.fromEntries(
    Object.entries(data).filter(([key]) => ALLOWED_FIELDS.includes(key))
  );

  const temporaryPassword = generateTemporaryPassword();
  const { data: authCreated, error: authErr } = await service.auth.admin.createUser({
    email,
    password: temporaryPassword,
    email_confirm: true,
  });

  if (authErr || !authCreated?.user) {
    const msg = authErr?.message || "";
    if (/registered|exists/i.test(msg)) {
      return { ok: false, error: "A user with this email already exists", status: 409 };
    }
    console.error("createUserAccount auth error:", msg);
    return { ok: false, error: "Failed to create auth account", status: 500 };
  }

  const { data: created, error } = await service
    .from("users")
    .insert({
      ...sanitized,
      auth_id: authCreated.user.id,
      preferences: { must_change_password: true },
    })
    .select()
    .single();

  if (error) {
    // Roll back the orphaned auth user so the email can be retried.
    await service.auth.admin.deleteUser(authCreated.user.id).catch(() => {});
    console.error("createUserAccount insert error:", error.message);
    return { ok: false, error: "Failed to create user record", status: 500 };
  }

  dispatchWebhook("user.created", { user_id: created.id, email: created.email }).catch(() => {});

  logAudit({
    userId: actingUserId,
    action: "created",
    entityType: "user",
    entityId: created.id,
    newValues: { email: created.email, role: created.role },
  });

  processRulesForUser(created.id, "user_created").catch((err) =>
    console.error("Automation rule processing failed:", err)
  );

  return { ok: true, user: created, temporaryPassword };
}
