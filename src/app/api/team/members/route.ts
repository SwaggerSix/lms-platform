import { authorize } from "@/lib/auth/authorize";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { logAudit } from "@/lib/audit";
import { dispatchWebhook } from "@/lib/webhooks/dispatcher";
import { processRulesForUser } from "@/lib/automation/rules-engine";
import { z } from "zod";
import crypto from "crypto";

// 16 bytes base64url ≈ 22 chars; Supabase requires ≥6.
function generateTemporaryPassword(): string {
  return crypto.randomBytes(16).toString("base64url");
}

const memberInputSchema = z.object({
  first_name: z.string().min(1).max(100),
  last_name: z.string().min(1).max(100),
  email: z.string().email(),
  job_title: z.string().max(200).optional().nullable(),
  status: z.enum(["active", "inactive", "suspended"]).optional(),
});

const createSchema = z.union([
  memberInputSchema,
  z.object({ members: z.array(memberInputSchema).min(1).max(500) }),
]);

type MemberInput = z.infer<typeof memberInputSchema>;

async function createMember(
  service: ReturnType<typeof createServiceClient>,
  managerId: string,
  input: MemberInput
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const temporaryPassword = generateTemporaryPassword();
  const { data: authCreated, error: authErr } =
    await service.auth.admin.createUser({
      email: input.email,
      password: temporaryPassword,
      email_confirm: true,
    });

  if (authErr || !authCreated?.user) {
    const msg = authErr?.message || "";
    if (/registered|exists/i.test(msg)) {
      return { ok: false, error: "A user with this email already exists" };
    }
    console.error("Team members auth create error:", msg);
    return { ok: false, error: "Failed to create auth account" };
  }

  const { data, error } = await service
    .from("users")
    .insert({
      first_name: input.first_name,
      last_name: input.last_name,
      email: input.email,
      job_title: input.job_title ?? null,
      status: input.status ?? "active",
      role: "learner",
      manager_id: managerId,
      auth_id: authCreated.user.id,
      preferences: { must_change_password: true },
    })
    .select("id, email, role")
    .single();

  if (error) {
    // Roll back the orphaned auth user so it can be retried with the same email.
    await service.auth.admin.deleteUser(authCreated.user.id).catch(() => {});
    console.error("Team members insert error:", error.message);
    return { ok: false, error: "Failed to create team member" };
  }

  dispatchWebhook("user.created", { user_id: data.id, email: data.email }).catch(
    () => {}
  );
  processRulesForUser(data.id, "user_created").catch(() => {});

  return { ok: true, id: data.id };
}

export async function POST(request: NextRequest) {
  const auth = await authorize("admin", "manager");
  if (!auth.authorized)
    return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const validation = createSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { error: validation.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const service = createServiceClient();
  const managerId = auth.user.id;

  const inputs: MemberInput[] =
    "members" in validation.data ? validation.data.members : [validation.data];

  // Single-member create: return a direct error for a clean UX.
  if (inputs.length === 1 && !("members" in validation.data)) {
    const result = await createMember(service, managerId, inputs[0]);
    if (!result.ok) {
      const status = /already exists/.test(result.error) ? 409 : 500;
      return NextResponse.json({ error: result.error }, { status });
    }
    logAudit({
      userId: managerId,
      action: "created",
      entityType: "user",
      entityId: result.id,
      newValues: { email: inputs[0].email, role: "learner" },
    });
    return NextResponse.json({ id: result.id }, { status: 201 });
  }

  // Bulk create (CSV import): process each row, collect per-row results.
  const created: string[] = [];
  const failed: { email: string; error: string }[] = [];
  for (const input of inputs) {
    const result = await createMember(service, managerId, input);
    if (result.ok) {
      created.push(result.id);
      logAudit({
        userId: managerId,
        action: "created",
        entityType: "user",
        entityId: result.id,
        newValues: { email: input.email, role: "learner" },
      });
    } else {
      failed.push({ email: input.email, error: result.error });
    }
  }

  return NextResponse.json(
    { created: created.length, failed },
    { status: failed.length === inputs.length ? 400 : 201 }
  );
}
