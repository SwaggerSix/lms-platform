import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/auth/authorize";
import { createServiceClient } from "@/lib/supabase/service";
import { encryptSecret, SECRET_MASK } from "@/lib/security/secret-crypto";
import { invalidateEmailConfigCache } from "@/lib/email/sender";

/**
 * GET /api/admin/email-settings — current email config (secret masked).
 */
export async function GET() {
  const auth = await authorize("admin", "super_admin");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const service = createServiceClient();
  const { data } = await service.from("platform_settings").select("value").eq("key", "email").maybeSingle();
  const v = (data?.value ?? {}) as { from?: string; api_key?: string };

  const hasStoredKey = !!v.api_key;
  const hasEnvKey = !!process.env.RESEND_API_KEY;

  return NextResponse.json({
    from: v.from ?? process.env.EMAIL_FROM ?? "",
    has_key: hasStoredKey || hasEnvKey,
    source: hasStoredKey ? "app" : hasEnvKey ? "env" : "none",
    api_key_masked: hasStoredKey ? SECRET_MASK : "",
  });
}

/**
 * PATCH /api/admin/email-settings — save From address and/or Resend API key.
 * Body: { from?, api_key? }  (api_key omitted or masked = keep existing)
 */
export async function PATCH(request: NextRequest) {
  const auth = await authorize("admin", "super_admin");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json().catch(() => ({}));
  const service = createServiceClient();
  const { data: existing } = await service.from("platform_settings").select("value").eq("key", "email").maybeSingle();
  const current = (existing?.value ?? {}) as { from?: string; api_key?: string };

  const next: { from?: string; api_key?: string } = { ...current };
  if (typeof body.from === "string") next.from = body.from.trim();
  if (typeof body.api_key === "string" && body.api_key && body.api_key !== SECRET_MASK) {
    next.api_key = encryptSecret(body.api_key.trim());
  }

  const { error } = await service
    .from("platform_settings")
    .upsert({ key: "email", value: next, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) {
    console.error("Email settings save error:", error.message);
    return NextResponse.json({ error: "Failed to save email settings" }, { status: 500 });
  }

  invalidateEmailConfigCache();
  return NextResponse.json({ success: true, from: next.from ?? "", has_key: !!next.api_key, source: next.api_key ? "app" : (process.env.RESEND_API_KEY ? "env" : "none") });
}
