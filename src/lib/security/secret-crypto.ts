import crypto from "crypto";

/**
 * At-rest encryption for integration credentials stored in
 * external_integrations.config (GEMS / SharePoint / HRIS / CRM / marketplace).
 *
 * Values are stored as "enc:v1:<iv>:<authTag>:<ciphertext>" (base64 parts,
 * AES-256-GCM). Reads fall back to returning the raw value when it doesn't
 * carry the prefix, so credentials saved before encryption was introduced
 * keep working; they are upgraded to encrypted form the next time they're
 * saved through the admin API.
 *
 * Key: INTEGRATION_ENCRYPTION_KEY (falls back to VC_ENCRYPTION_KEY so a
 * single key can serve all integrations). If no key is configured, writes
 * keep today's behavior (plaintext) and log loudly rather than bricking
 * credential saves.
 */

const PREFIX = "enc:v1:";

/** The mask the admin API returns instead of stored secrets. */
export const SECRET_MASK = "••••••••";

/** config fields treated as secrets across all integration providers. */
export const SECRET_CONFIG_FIELDS = [
  "api_key",
  "api_key_encrypted",
  "client_secret",
  "client_secret_encrypted",
  "access_token",
  "access_token_encrypted",
  "refresh_token",
  "refresh_token_encrypted",
  "password",
  "service_user_password_encrypted",
  "webhook_secret",
] as const;

function getKey(): Buffer | null {
  const raw = process.env.INTEGRATION_ENCRYPTION_KEY || process.env.VC_ENCRYPTION_KEY;
  if (!raw) return null;
  return crypto.createHash("sha256").update(raw).digest();
}

export function encryptSecret(plaintext: string): string {
  const key = getKey();
  if (!key) {
    if (process.env.NODE_ENV === "production") {
      console.error(
        "INTEGRATION_ENCRYPTION_KEY is not set — integration secrets are being stored unencrypted"
      );
    }
    return plaintext;
  }
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64")}:${authTag.toString("base64")}:${encrypted.toString("base64")}`;
}

/** Decrypts values produced by encryptSecret; passes other values through. */
export function decryptIfEncrypted(value: string): string {
  if (!value.startsWith(PREFIX)) return value;
  const key = getKey();
  if (!key) {
    throw new Error(
      "Found an encrypted integration secret but INTEGRATION_ENCRYPTION_KEY is not set"
    );
  }
  const [ivB64, tagB64, dataB64] = value.slice(PREFIX.length).split(":");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

type Config = Record<string, unknown>;

/** Encrypts known secret fields in an integration config before persisting. */
export function encryptConfigSecrets<T extends Config>(config: T): T {
  const out: Config = { ...config };
  for (const field of SECRET_CONFIG_FIELDS) {
    const value = out[field];
    if (typeof value === "string" && value && value !== SECRET_MASK && !value.startsWith(PREFIX)) {
      out[field] = encryptSecret(value);
    }
  }
  return out as T;
}

/** Decrypts known secret fields in an integration config after loading. */
export function decryptConfigSecrets<T extends Config>(config: T | null | undefined): T {
  const out: Config = { ...(config ?? {}) };
  for (const field of SECRET_CONFIG_FIELDS) {
    const value = out[field];
    if (typeof value === "string" && value.startsWith(PREFIX)) {
      out[field] = decryptIfEncrypted(value);
    }
  }
  return out as T;
}

/**
 * Strips masked secret values from a client-submitted config update so a
 * round-tripped "••••••••" never overwrites the stored secret.
 */
export function stripMaskedSecrets<T extends Config>(config: T): T {
  const out: Config = { ...config };
  for (const field of SECRET_CONFIG_FIELDS) {
    if (out[field] === SECRET_MASK) delete out[field];
  }
  return out as T;
}

/** Replaces secret fields with a mask for API responses. */
export function maskConfigSecrets<T extends Config>(config: T | null | undefined): T {
  const out: Config = { ...(config ?? {}) };
  for (const field of SECRET_CONFIG_FIELDS) {
    if (typeof out[field] === "string" && out[field]) out[field] = SECRET_MASK;
  }
  return out as T;
}
