import { authorize } from "@/lib/auth/authorize";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { randomBytes, createHash } from "crypto";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function POST(request: NextRequest) {
  const auth = await authorize("admin");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { provider_id } = body;
  if (!provider_id || typeof provider_id !== "string") {
    return NextResponse.json({ error: "provider_id is required" }, { status: 400 });
  }

  const service = createServiceClient();

  // Verify provider exists
  const { data: provider, error: fetchError } = await service
    .from("sso_providers")
    .select("id, scim_enabled")
    .eq("id", provider_id)
    .single();

  if (fetchError || !provider) {
    return NextResponse.json({ error: "SSO provider not found" }, { status: 404 });
  }

  // Generate a random SCIM token
  const plainToken = `scim_${randomBytes(32).toString("hex")}`;
  const tokenHash = hashToken(plainToken);

  // Store the hash and enable SCIM
  const { error: updateError } = await service
    .from("sso_providers")
    .update({
      scim_token_hash: tokenHash,
      scim_enabled: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", provider_id);

  if (updateError) {
    console.error("SCIM token generation error:", updateError.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  // Return the plaintext token only once
  return NextResponse.json({
    token: plainToken,
    message: "SCIM token generated. Store this token securely — it will not be shown again.",
  });
}
