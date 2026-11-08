import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/auth/authorize";
import { createServiceClient } from "@/lib/supabase/service";
import { rateLimit } from "@/lib/rate-limit";
import { MAX_ZIP_BYTES, SCORM_BUCKET, SCORM_STAGING_PREFIX } from "@/lib/scorm/package";

/**
 * POST /api/scorm/upload-url  { file_name, file_size }
 *
 * Returns a one-time signed upload URL so the browser can send the .zip
 * straight to Supabase Storage. Going through a Vercel function instead caps
 * the request body at ~4.5MB, which most real SCORM exports exceed.
 */
export async function POST(request: NextRequest) {
  const auth = await authorize("admin", "instructor");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const rl = await rateLimit(`scorm-upload-url-${auth.user.id}`, 20, 60000);
  if (!rl.success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  let body: { file_name?: unknown; file_size?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const size = typeof body.file_size === "number" ? body.file_size : 0;
  if (size > MAX_ZIP_BYTES) {
    return NextResponse.json(
      { error: `SCORM package is too large (max ${Math.round(MAX_ZIP_BYTES / 1024 / 1024)}MB).` },
      { status: 400 }
    );
  }
  if (typeof body.file_name !== "string" || !/\.zip$/i.test(body.file_name)) {
    return NextResponse.json({ error: "Choose a .zip SCORM package." }, { status: 400 });
  }

  const path = `${SCORM_STAGING_PREFIX}/${auth.user.id}/${crypto.randomUUID()}.zip`;
  const service = createServiceClient();
  const { data, error } = await service.storage.from(SCORM_BUCKET).createSignedUploadUrl(path);
  if (error || !data) {
    console.error("SCORM signed upload URL error:", error?.message);
    return NextResponse.json({ error: "Could not start the upload." }, { status: 500 });
  }

  return NextResponse.json({ path: data.path, signedUrl: data.signedUrl, token: data.token });
}
