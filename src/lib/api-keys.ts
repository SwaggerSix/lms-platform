import crypto from "crypto";
import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-side API key generation and verification.
 *
 * A key is a high-entropy random secret shown to the admin exactly once; only
 * its SHA-256 hash is stored, so the platform can verify a presented key
 * without ever persisting the secret. (SHA-256 is appropriate here because the
 * secret is 256 bits of randomness, not a low-entropy password.)
 */

export const API_KEY_PREFIX = "lms";

export function hashApiKey(secret: string): string {
  return crypto.createHash("sha256").update(secret).digest("hex");
}

export interface GeneratedApiKey {
  secret: string;
  hash: string;
  prefix: string;
  lastFour: string;
}

export function generateApiKey(): GeneratedApiKey {
  const random = crypto.randomBytes(32).toString("base64url");
  const secret = `${API_KEY_PREFIX}_${random}`;
  return {
    secret,
    hash: hashApiKey(secret),
    prefix: secret.slice(0, API_KEY_PREFIX.length + 1 + 8), // e.g. "lms_" + 8 chars
    lastFour: secret.slice(-4),
  };
}

/**
 * Verify a presented API key against the stored hashes. Returns the active key
 * record on success (and stamps last_used_at), or null. Intended for
 * machine-to-machine routes that authenticate via an API key header.
 */
export async function verifyApiKey(
  service: SupabaseClient,
  rawKey: string | null | undefined
): Promise<{ id: string; organization_id: string | null } | null> {
  if (!rawKey) return null;
  const hash = hashApiKey(rawKey);

  const { data } = await service
    .from("api_keys")
    .select("id, organization_id, status")
    .eq("key_hash", hash)
    .maybeSingle();

  if (!data || data.status !== "active") return null;

  // Best-effort last-used stamp; never block the caller on it.
  void service
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id)
    .then(
      () => {},
      () => {}
    );

  return { id: data.id, organization_id: data.organization_id };
}
