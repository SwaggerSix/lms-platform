"use client";

/** Ask for a signed URL, then PUT the file straight to storage. Returns the stored path. */
export async function uploadCapstoneFile(
  certificationId: string,
  slot: "memo" | "briefing" | "pushback",
  file: Blob,
  onProgress?: (pct: number) => void
): Promise<string> {
  const contentType = (file.type || "application/octet-stream").split(";")[0];
  const res = await fetch(`/api/certifications/${certificationId}/capstone/upload-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slot, file_size: file.size, content_type: contentType }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || "Could not start the upload.");
  const { path, signedUrl } = body as { path: string; signedUrl: string };
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", signedUrl);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.setRequestHeader("Content-Type", contentType);
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (anon) xhr.setRequestHeader("apikey", anon);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status}). Please try again.`));
    xhr.onerror = () => reject(new Error("Upload failed: the connection dropped. Please try again."));
    xhr.send(file);
  });
  return path;
}
