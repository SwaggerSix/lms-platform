"use client";

import { RESUMABLE_OVER_BYTES, contentTypeFor, type CapstoneKind } from "./capstone";

type Slot = CapstoneKind | "pushback";
interface Signed {
  path: string;
  signedUrl: string;
  token: string;
}

async function sign(certificationId: string, body: Record<string, unknown>): Promise<Signed> {
  const res = await fetch(`/api/certifications/${certificationId}/capstone/upload-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Could not start the upload.");
  return data as Signed;
}

/**
 * Where resumable uploads go. Storage's own hostname (<ref>.storage.supabase.co)
 * is the one Supabase says to use for large files; anything else (a custom
 * domain, local development) keeps the host the signed link came from.
 */
export function resumableEndpoint(signedUrl: string): string {
  const u = new URL(signedUrl);
  const m = /^([a-z0-9]+)\.supabase\.co$/.exec(u.hostname);
  const host = m ? `${m[1]}.storage.supabase.co` : u.host;
  return `${u.protocol}//${host}/storage/v1/upload/resumable`;
}

/** Bucket and object name out of a signed upload link (…/object/upload/sign/<bucket>/<path>?token=…). */
export function signedTarget(signedUrl: string): { bucket: string; object: string } | null {
  const m = /\/object\/upload\/sign\/([^/]+)\/(.+)$/.exec(new URL(signedUrl).pathname);
  return m ? { bucket: decodeURIComponent(m[1]), object: decodeURIComponent(m[2]) } : null;
}

// An upload token lasts two hours; ask for a new one well before that.
const RENEW_AFTER_MS = 60 * 60 * 1000;

/** Ask for a signed URL, then send the file straight to storage. Returns the stored path. */
export async function uploadCapstoneFile(
  certificationId: string,
  slot: Slot,
  file: Blob & { name?: string },
  onProgress?: (pct: number) => void
): Promise<string> {
  const contentType = contentTypeFor(file);
  const request = { slot, file_size: file.size, content_type: contentType };
  const signed = await sign(certificationId, request);
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (file.size > RESUMABLE_OVER_BYTES) {
    await sendResumable(file, contentType, signed, anon, onProgress, () =>
      sign(certificationId, { ...request, renew_path: signed.path })
    );
    return signed.path;
  }

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", signed.signedUrl);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.setRequestHeader("Content-Type", contentType);
    if (anon) xhr.setRequestHeader("apikey", anon);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status}). Please try again.`));
    xhr.onerror = () => reject(new Error("Upload failed: the connection dropped. Please try again."));
    xhr.send(file);
  });
  return signed.path;
}

/**
 * A large file (a recorded presentation) goes in 6 MB chunks over the TUS
 * protocol, so a dropped connection costs one chunk, not the whole upload.
 * The signed upload token authorises it (x-signature); no session is needed.
 */
async function sendResumable(
  file: Blob,
  contentType: string,
  signed: Signed,
  anon: string | undefined,
  onProgress: ((pct: number) => void) | undefined,
  renew: () => Promise<Signed>
): Promise<void> {
  const target = signedTarget(signed.signedUrl);
  if (!target) throw new Error("Could not start the upload.");
  const { Upload } = await import("tus-js-client");
  let token = signed.token;
  let tokenAt = Date.now();
  let renewing: Promise<void> | null = null;

  await new Promise<void>((resolve, reject) => {
    const upload = new Upload(file, {
      endpoint: resumableEndpoint(signed.signedUrl),
      // About four minutes of patience across a dropped connection.
      retryDelays: [0, 3000, 5000, 10000, 20000, 30000, 60000, 120000],
      chunkSize: 6 * 1024 * 1024, // Storage requires exactly 6 MB.
      uploadDataDuringCreation: true,
      // Every hand-in gets a new path, so there is nothing to resume in a later visit.
      storeFingerprintForResuming: false,
      removeFingerprintOnSuccess: true,
      headers: { "x-upsert": "false", ...(anon ? { apikey: anon } : {}) },
      metadata: {
        bucketName: target.bucket,
        objectName: target.object,
        contentType,
        cacheControl: "3600",
      },
      onBeforeRequest: async (req) => {
        if (Date.now() - tokenAt > RENEW_AFTER_MS) {
          renewing ??= renew()
            .then((s) => {
              token = s.token;
              tokenAt = Date.now();
            })
            // Keep the old token; if it has really expired the request fails and says so.
            .catch(() => {})
            .finally(() => {
              renewing = null;
            });
          await renewing;
        }
        req.setHeader("x-signature", token);
      },
      onProgress: (sent, total) => {
        if (onProgress && total) onProgress(Math.min(99, Math.floor((sent / total) * 100)));
      },
      onSuccess: () => {
        onProgress?.(100);
        resolve();
      },
      onError: (err) => {
        console.error("Capstone resumable upload error:", err);
        reject(new Error(resumableError(err)));
      },
    });
    upload.start();
  });
}

function resumableError(err: unknown): string {
  const status = (err as { originalResponse?: { getStatus?: () => number } | null })?.originalResponse?.getStatus?.();
  if (status === 413) {
    return "That file is larger than the site's storage currently accepts. Please tell your assessor; nothing was handed in.";
  }
  if (status) return `Upload failed (${status}). Please try again.`;
  return "Upload failed: the connection dropped and didn't come back. Please try again.";
}
