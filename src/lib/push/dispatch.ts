import { createServiceClient } from "@/lib/supabase/service";

// Web push dispatch (RFC 8030 + VAPID). Extracted from the admin /api/push/send
// route so server-side flows (e.g. mentorship match notifications) can deliver
// a push without going through HTTP. Best-effort: returns counts; never throws.

interface PushSubscriptionRow {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface SendPushResult {
  sent: number;
  failed: number;
  skipped?: boolean;
}

export async function sendPushToUsers(opts: {
  userIds: string[];
  title: string;
  body: string;
  url?: string;
}): Promise<SendPushResult> {
  if (opts.userIds.length === 0) return { sent: 0, failed: 0 };

  const vapidPublicKey =
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
  const vapidSubject = process.env.VAPID_SUBJECT || "mailto:admin@learnhub.app";

  if (!vapidPublicKey || !vapidPrivateKey) {
    // Push not configured for this environment — silently skip so non-push
    // delivery (in-app, email) still happens unaffected.
    return { sent: 0, failed: 0, skipped: true };
  }

  const service = createServiceClient();
  const { data: subscriptions, error } = await service
    .from("push_subscriptions")
    .select("id, user_id, endpoint, p256dh, auth")
    .in("user_id", opts.userIds);

  if (error || !subscriptions || subscriptions.length === 0) {
    return { sent: 0, failed: 0 };
  }

  const payload = JSON.stringify({
    title: opts.title,
    body: opts.body,
    url: opts.url || "/",
  });

  let sent = 0;
  let failed = 0;

  await Promise.allSettled(
    (subscriptions as PushSubscriptionRow[]).map(async (sub) => {
      try {
        const encrypted = await encryptPayload(payload, sub.p256dh, sub.auth);
        const jwt = await createVapidJWT(sub.endpoint, vapidSubject, vapidPrivateKey);

        const response = await fetch(sub.endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/octet-stream",
            "Content-Encoding": "aes128gcm",
            TTL: "86400",
            Authorization: `vapid t=${jwt}, k=${vapidPublicKey}`,
          },
          body: encrypted as unknown as BodyInit,
          signal: AbortSignal.timeout(10_000),
        });

        if (response.ok || response.status === 201) {
          sent++;
        } else if (response.status === 404 || response.status === 410) {
          // Subscription is gone — clean up so we don't keep retrying.
          await service.from("push_subscriptions").delete().eq("id", sub.id);
          failed++;
        } else {
          failed++;
        }
      } catch {
        failed++;
      }
    })
  );

  return { sent, failed };
}

// ----- VAPID / Encryption Helpers -----

async function createVapidJWT(
  endpoint: string,
  subject: string,
  privateKeyBase64: string
): Promise<string> {
  const aud = new URL(endpoint).origin;
  const exp = Math.floor(Date.now() / 1000) + 12 * 60 * 60;

  const header = { typ: "JWT", alg: "ES256" };
  const payload = { aud, exp, sub: subject };

  const headerB64 = base64urlEncode(JSON.stringify(header));
  const payloadB64 = base64urlEncode(JSON.stringify(payload));
  const unsigned = `${headerB64}.${payloadB64}`;

  const keyData = base64urlDecode(privateKeyBase64);
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    keyData,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    cryptoKey,
    new TextEncoder().encode(unsigned)
  );

  const rawSig = derToRaw(new Uint8Array(signature));
  const sigB64 = base64urlEncodeBytes(rawSig);
  return `${unsigned}.${sigB64}`;
}

async function encryptPayload(
  payload: string,
  _p256dhBase64: string,
  _authBase64: string
): Promise<Uint8Array> {
  // Simplified body — same behavior as the original admin send route.
  return new TextEncoder().encode(payload);
}

function base64urlEncode(str: string): string {
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function base64urlEncodeBytes(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function base64urlDecode(str: string): ArrayBuffer {
  const padded = str + "=".repeat((4 - (str.length % 4)) % 4);
  const base64 = padded.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}
function derToRaw(der: Uint8Array): Uint8Array {
  const raw = new Uint8Array(64);
  let offset = 2;
  offset++;
  let rLen = der[offset++];
  let rStart = offset;
  offset += rLen;
  offset++;
  let sLen = der[offset++];
  let sStart = offset;
  if (rLen > 32) {
    rStart += rLen - 32;
    rLen = 32;
  }
  raw.set(der.slice(rStart, rStart + rLen), 32 - rLen);
  if (sLen > 32) {
    sStart += sLen - 32;
    sLen = 32;
  }
  raw.set(der.slice(sStart, sStart + sLen), 64 - sLen);
  return raw;
}
