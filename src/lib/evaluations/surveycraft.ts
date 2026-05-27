import crypto from "crypto";

// Wire contract shared byte-for-byte with the SurveyCraft side. Do not change
// the field names or encoding without updating both systems together.

export interface EmbedTokenPayload {
  a: string; // assignmentId
  u: string; // userId
  t: string; // tenant
  tpl: string; // templateId
  iat: number; // issued-at (unix seconds)
  exp: number; // expiry (unix seconds)
}

export interface MintEmbedTokenInput {
  assignmentId: string;
  userId: string;
  tenant: string;
  templateId: string;
  ttlSeconds?: number;
}

const DEFAULT_TTL_SECONDS = 7 * 24 * 3600; // 7 days

function base64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlToBuffer(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

function getSecret(): string {
  const secret = process.env.EVALUATION_EMBED_SECRET;
  if (!secret) throw new Error("EVALUATION_EMBED_SECRET is not configured");
  return secret;
}

function sign(p: string): string {
  return base64url(crypto.createHmac("sha256", getSecret()).update(p).digest());
}

export function mintEmbedToken(input: MintEmbedTokenInput): string {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + (input.ttlSeconds ?? DEFAULT_TTL_SECONDS);
  const payload: EmbedTokenPayload = {
    a: input.assignmentId,
    u: input.userId,
    t: input.tenant,
    tpl: input.templateId,
    iat,
    exp,
  };
  const p = base64url(Buffer.from(JSON.stringify(payload), "utf8"));
  return `${p}.${sign(p)}`;
}

// Returns the decoded payload, or null if the token is malformed, the
// signature does not verify, or it has expired.
export function verifyEmbedToken(token: string): EmbedTokenPayload | null {
  if (typeof token !== "string") return null;
  const dot = token.indexOf(".");
  if (dot <= 0 || dot === token.length - 1) return null;
  const p = token.slice(0, dot);
  const sig = token.slice(dot + 1);

  let expected: string;
  try {
    expected = sign(p);
  } catch {
    return null;
  }

  // Timing-safe comparison; bail if lengths differ to avoid timingSafeEqual throwing.
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  let payload: EmbedTokenPayload;
  try {
    payload = JSON.parse(base64urlToBuffer(p).toString("utf8"));
  } catch {
    return null;
  }

  if (typeof payload.exp !== "number" || payload.exp < Math.floor(Date.now() / 1000)) {
    return null;
  }

  return payload;
}

export function buildEmbedUrl(slug: string, token: string): string {
  const base = process.env.SURVEYCRAFT_BASE_URL;
  if (!base) throw new Error("SURVEYCRAFT_BASE_URL is not configured");
  return `${base.replace(/\/+$/, "")}/s/${slug}?lt=${encodeURIComponent(token)}`;
}
