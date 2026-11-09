import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/auth/authorize";
import { getEffectivePermissionsForUser } from "@/lib/auth/authorize-permission";
import { createServiceClient } from "@/lib/supabase/service";
import { rateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { SCORM_BUCKET, SCORM_STAGING_PREFIX, isUuid } from "@/lib/scorm/package";
import { ScormPackageError, extractAndStorePackageFrom } from "@/lib/scorm/extract";
import { httpReader } from "@/lib/scorm/remote-zip";
import { assertTargetEditable, attachPackage, type AttachTarget } from "@/lib/scorm/attach";

// Extraction downloads, unzips and re-uploads every file in the package.
export const maxDuration = 300;

/**
 * POST /api/scorm/import
 *   { upload_path, file_name?, lesson_id? | course_id? , title? }
 *
 * Extracts a zip previously uploaded via /api/scorm/upload-url and attaches it:
 *   lesson_id  → replace that lesson's content with the package
 *   course_id  → add a new SCORM lesson to that course
 *   neither    → create a new draft course containing one SCORM lesson
 */
export async function POST(request: NextRequest) {
  const auth = await authorize("admin", "instructor");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const rl = await rateLimit(`scorm-import-${auth.user.id}`, 10, 60000);
  if (!rl.success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const uploadPath = typeof body.upload_path === "string" ? body.upload_path : "";
  // Only the uploader's own staged zip may be processed.
  const ownPrefix = `${SCORM_STAGING_PREFIX}/${auth.user.id}/`;
  if (!uploadPath.startsWith(ownPrefix) || uploadPath.includes("..") || !uploadPath.endsWith(".zip")) {
    return NextResponse.json({ error: "Invalid upload reference." }, { status: 400 });
  }

  const lessonId = typeof body.lesson_id === "string" && body.lesson_id ? body.lesson_id : null;
  const courseId = typeof body.course_id === "string" && body.course_id ? body.course_id : null;
  const title = typeof body.title === "string" ? body.title.trim().slice(0, 200) : undefined;
  const fileName = typeof body.file_name === "string" ? body.file_name.slice(0, 255) : null;
  if ((lessonId && !isUuid(lessonId)) || (courseId && !isUuid(courseId))) {
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  }

  const target: AttachTarget = lessonId
    ? { kind: "lesson", lessonId }
    : courseId
      ? { kind: "course", courseId, title }
      : { kind: "new-course", title };

  const service = createServiceClient();
  const user = { id: auth.user.id, role: auth.user.role };

  if (target.kind === "new-course" && user.role !== "super_admin") {
    const permissions = await getEffectivePermissionsForUser(auth.user);
    if (!permissions.includes("courses.create")) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }
  }

  const removeStaged = () => service.storage.from(SCORM_BUCKET).remove([uploadPath]).then(() => {}, () => {});

  try {
    await assertTargetEditable(service, user, target);

    // Read the staged zip by byte ranges rather than downloading it whole:
    // buffering a several-hundred-MB package (plus its inflated files) got
    // this function killed for running out of memory.
    const { data: signed, error: signErr } = await service.storage
      .from(SCORM_BUCKET)
      .createSignedUrl(uploadPath, 60 * 30);
    if (signErr || !signed?.signedUrl) {
      return NextResponse.json({ error: "Uploaded file not found. Please upload it again." }, { status: 404 });
    }
    let reader: Awaited<ReturnType<typeof httpReader>>;
    try {
      reader = await httpReader(signed.signedUrl);
    } catch (e) {
      console.error("SCORM staged zip read error:", e);
      return NextResponse.json({ error: "Uploaded file not found. Please upload it again." }, { status: 404 });
    }

    const pkg = await extractAndStorePackageFrom(service, reader.read, reader.size);
    const result = await attachPackage(service, user, target, pkg, fileName);

    logAudit({
      userId: auth.user.id,
      action: result.createdCourse ? "created" : "updated",
      entityType: result.createdCourse ? "course" : "lesson",
      entityId: result.createdCourse ? result.courseId : result.lessonId,
      newValues: { scorm_package_id: pkg.packageId, scorm_version: pkg.version, file_name: fileName },
    });

    await removeStaged();
    return NextResponse.json(
      {
        ...result,
        version: pkg.version,
        manifestTitle: pkg.title,
        fileCount: pkg.fileCount,
        totalBytes: pkg.totalBytes,
      },
      { status: 201 }
    );
  } catch (e) {
    await removeStaged();
    if (e instanceof ScormPackageError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("SCORM import error:", e);
    return NextResponse.json({ error: "Import failed. Please try again." }, { status: 500 });
  }
}
