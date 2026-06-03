import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/auth/authorize";
import { createServiceClient } from "@/lib/supabase/service";
import { rateLimit } from "@/lib/rate-limit";
import { unzipSync, strFromU8 } from "fflate";

// In-memory extraction caps SCORM packages to a serverless-safe size.
const MAX_ZIP_BYTES = 100 * 1024 * 1024; // 100MB
const BUCKET = "course-content";

const CONTENT_TYPES: Record<string, string> = {
  html: "text/html",
  htm: "text/html",
  js: "text/javascript",
  mjs: "text/javascript",
  css: "text/css",
  json: "application/json",
  xml: "application/xml",
  txt: "text/plain",
  csv: "text/csv",
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  ico: "image/x-icon",
  mp4: "video/mp4",
  webm: "video/webm",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  woff: "font/woff",
  woff2: "font/woff2",
  ttf: "font/ttf",
  otf: "font/otf",
  pdf: "application/pdf",
};

function contentTypeFor(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return CONTENT_TYPES[ext] ?? "application/octet-stream";
}

/**
 * Find the SCORM launch file. Prefers the href of the resource referenced by
 * the manifest's default organization; falls back to common launch filenames,
 * then to the shallowest HTML file in the package.
 */
function resolveLaunchFile(files: Record<string, Uint8Array>): string | null {
  const paths = Object.keys(files);
  const manifestKey = paths.find((p) => p.toLowerCase().endsWith("imsmanifest.xml"));
  const base = manifestKey ? manifestKey.slice(0, manifestKey.toLowerCase().lastIndexOf("imsmanifest.xml")) : "";

  if (manifestKey) {
    try {
      const xml = strFromU8(files[manifestKey]);
      // First resource href (SCORM launch is the first resource's href).
      const hrefMatch = xml.match(/<resource\b[^>]*\bhref="([^"]+)"/i);
      if (hrefMatch) {
        const href = decodeURIComponent(hrefMatch[1].split("?")[0]);
        const candidate = (base + href).replace(/\\/g, "/");
        if (files[candidate]) return candidate;
        // Try matching ignoring leading "./"
        const norm = candidate.replace(/^\.\//, "");
        const found = paths.find((p) => p === norm || p.endsWith("/" + norm));
        if (found) return found;
      }
    } catch {
      // fall through to heuristics
    }
  }

  const common = ["index_lms.html", "index.html", "story.html", "index.htm", "launch.html"];
  for (const name of common) {
    const found = paths.find((p) => p.toLowerCase().endsWith(name));
    if (found) return found;
  }

  const htmls = paths
    .filter((p) => /\.html?$/i.test(p))
    .sort((a, b) => a.split("/").length - b.split("/").length);
  return htmls[0] ?? null;
}

/**
 * POST /api/scorm/upload  (multipart: file=<zip>, optional lesson_id)
 * Extracts a SCORM package into the course-content bucket and returns the
 * launch URL. If lesson_id is given, marks that lesson as a SCORM lesson
 * pointing at the launch file.
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
  if (file.size > MAX_ZIP_BYTES) {
    return NextResponse.json(
      { error: "SCORM package is too large (max 100MB)." },
      { status: 400 }
    );
  }

  const buffer = new Uint8Array(await file.arrayBuffer());
  // Zip magic bytes (PK\x03\x04).
  if (buffer.length < 4 || buffer[0] !== 0x50 || buffer[1] !== 0x4b) {
    return NextResponse.json({ error: "File is not a valid .zip package." }, { status: 400 });
  }

  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(buffer);
  } catch {
    return NextResponse.json({ error: "Could not read the .zip package." }, { status: 400 });
  }

  // Drop directory entries (zero-length keys ending with "/").
  const entries = Object.entries(files).filter(([p]) => p && !p.endsWith("/"));
  if (entries.length === 0) {
    return NextResponse.json({ error: "The package is empty." }, { status: 400 });
  }

  const launch = resolveLaunchFile(Object.fromEntries(entries));
  if (!launch) {
    return NextResponse.json(
      { error: "Could not find a launch file (e.g. index.html) in the package." },
      { status: 400 }
    );
  }

  const service = createServiceClient();
  const prefix = `scorm/${crypto.randomUUID()}`;

  for (const [path, bytes] of entries) {
    const { error: upErr } = await service.storage
      .from(BUCKET)
      .upload(`${prefix}/${path}`, bytes, {
        contentType: contentTypeFor(path),
        upsert: true,
        cacheControl: "3600",
      });
    if (upErr) {
      console.error("SCORM upload error:", upErr.message);
      return NextResponse.json({ error: "Failed to store the package." }, { status: 500 });
    }
  }

  const { data: urlData } = service.storage
    .from(BUCKET)
    .getPublicUrl(`${prefix}/${launch}`);
  const launchUrl = urlData.publicUrl;

  // Optionally attach to a lesson.
  if (typeof lessonId === "string" && lessonId) {
    const { error: lessonErr } = await service
      .from("lessons")
      .update({ content_type: "scorm", content_url: launchUrl })
      .eq("id", lessonId);
    if (lessonErr) {
      console.error("SCORM lesson update error:", lessonErr.message);
    }
  }

  return NextResponse.json({ launchUrl, fileCount: entries.length }, { status: 201 });
}
