import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/auth/authorize";
import { createServiceClient } from "@/lib/supabase/service";
import { rateLimit } from "@/lib/rate-limit";
import { isUuid } from "@/lib/scorm/package";
import { ScormPackageError, extractAndStorePackage } from "@/lib/scorm/extract";
import { assertTargetEditable, attachPackage } from "@/lib/scorm/attach";

export const maxDuration = 300;

/**
 * POST /api/scorm/upload  (multipart: file=<zip>, optional lesson_id)
 *
 * Direct upload kept for API callers and very small packages. Vercel caps
 * function request bodies at ~4.5MB, so the admin UI uses the signed-URL flow
 * (/api/scorm/upload-url → /api/scorm/import) instead.
 */
export async function POST(request: NextRequest) {
  const auth = await authorize("admin", "instructor");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const rl = await rateLimit(`scorm-upload-${auth.user.id}`, 10, 60000);
  if (!rl.success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = form.get("file");
  const lessonId = form.get("lesson_id");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (lessonId !== null && (typeof lessonId !== "string" || (lessonId && !isUuid(lessonId)))) {
    return NextResponse.json({ error: "Invalid lesson_id" }, { status: 400 });
  }

  const service = createServiceClient();
  const user = { id: auth.user.id, role: auth.user.role };

  try {
    if (lessonId) await assertTargetEditable(service, user, { kind: "lesson", lessonId });
    const pkg = await extractAndStorePackage(service, new Uint8Array(await file.arrayBuffer()));
    if (lessonId) {
      await attachPackage(service, user, { kind: "lesson", lessonId }, pkg, file.name);
    }
    return NextResponse.json(
      { launchUrl: pkg.launchUrl, fileCount: pkg.fileCount, version: pkg.version },
      { status: 201 }
    );
  } catch (e) {
    if (e instanceof ScormPackageError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("SCORM upload error:", e);
    return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 500 });
  }
}
