import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/auth/authorize";
import { createServiceClient } from "@/lib/supabase/service";
import { logAudit } from "@/lib/audit";
import { buildProvenanceColumns } from "@/lib/courses/cover-provenance";
import * as XLSX from "xlsx";

export const runtime = "nodejs";

const BUCKET = "course-images";
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_BYTES = 5 * 1024 * 1024;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function pick(row: Record<string, unknown>, ...fragments: string[]): string {
  for (const frag of fragments) {
    const key = Object.keys(row).find((k) => k.toLowerCase().replace(/[\s_]+/g, "") === frag.toLowerCase().replace(/[\s_]+/g, ""));
    if (key && row[key] != null && String(row[key]).trim()) return String(row[key]).trim();
  }
  // looser contains match as a fallback
  for (const frag of fragments) {
    const key = Object.keys(row).find((k) => k.toLowerCase().includes(frag.toLowerCase()));
    if (key && row[key] != null && String(row[key]).trim()) return String(row[key]).trim();
  }
  return "";
}

function extFor(mime: string): string {
  return ({ "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" } as Record<string, string>)[mime] || "img";
}

function detectMime(bytes: Uint8Array): string | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) return "image/gif";
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return "image/webp";
  return null;
}

/** Remove a previously stored cover object we own (best-effort). */
async function removeOwned(service: ReturnType<typeof createServiceClient>, thumbnailUrl: string | null) {
  if (!thumbnailUrl) return;
  const marker = `/object/public/${BUCKET}/`;
  const idx = thumbnailUrl.indexOf(marker);
  if (idx === -1) return;
  const path = decodeURIComponent(thumbnailUrl.slice(idx + marker.length));
  if (path) await service.storage.from(BUCKET).remove([path]).catch(() => {});
}

interface RowResult {
  row: number;
  course: string;
  status: "updated" | "skipped" | "error";
  detail: string;
  duplicates_updated?: number;
}

/**
 * POST /api/courses/cover-import
 * Bulk-set course cover images from a spreadsheet (.xlsx/.csv). Each row points
 * a course (by course_id or slug) at a public image_url which the server fetches,
 * validates, and stores in the course-images bucket along with licensing
 * provenance. With applyDuplicates on, the same image + provenance is applied to
 * other courses that share the exact title (the mirrored storefront copy).
 */
export async function POST(request: NextRequest) {
  const auth = await authorize("admin", "super_admin");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  const applyDuplicates = (formData.get("applyDuplicates")?.toString() ?? "true") !== "false";

  // Optional image files uploaded alongside the sheet; rows reference them by `filename`.
  const uploadedByName = new Map<string, File>();
  for (const v of formData.getAll("images")) {
    if (v instanceof File && v.name) uploadedByName.set(v.name.toLowerCase(), v);
  }

  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(Buffer.from(await file.arrayBuffer()), { type: "buffer" });
  } catch {
    return NextResponse.json({ error: "Could not read the spreadsheet" }, { status: 400 });
  }
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return NextResponse.json({ error: "No data sheet found" }, { status: 400 });
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

  const service = createServiceClient();
  const results: RowResult[] = [];
  let updated = 0;
  let duplicatesUpdated = 0;
  let skipped = 0;

  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 2; // account for header row
    const row = rows[i];
    const courseId = pick(row, "course_id", "courseid", "id");
    const slug = pick(row, "slug");
    const imageUrl = pick(row, "image_url", "imageurl", "url", "image");
    const filename = pick(row, "filename", "file_name", "image_file", "file");
    const ident = courseId || slug;

    if (!ident && !imageUrl && !filename) { skipped++; continue; } // blank row
    if (!imageUrl && !filename) {
      results.push({ row: rowNum, course: ident || "(none)", status: "error", detail: "Provide image_url or filename" });
      continue;
    }

    // Resolve the course.
    let q = service.from("courses").select("id, title, thumbnail_url");
    q = UUID_RE.test(courseId) ? q.eq("id", courseId) : q.eq("slug", slug || courseId);
    const { data: course } = await q.single();
    if (!course) {
      results.push({ row: rowNum, course: ident, status: "error", detail: "Course not found" });
      continue;
    }

    // Acquire image bytes — from an uploaded file (by filename) or by fetching the URL.
    let bytes: Uint8Array;
    if (filename) {
      const f = uploadedByName.get(filename.toLowerCase());
      if (!f) {
        results.push({ row: rowNum, course: course.title, status: "error", detail: `No uploaded file named "${filename}"` });
        continue;
      }
      const ab = await f.arrayBuffer();
      if (ab.byteLength > MAX_BYTES) {
        results.push({ row: rowNum, course: course.title, status: "error", detail: "Image exceeds 5MB" });
        continue;
      }
      bytes = new Uint8Array(ab);
    } else {
      if (!/^https?:\/\//i.test(imageUrl)) {
        results.push({ row: rowNum, course: course.title, status: "error", detail: "image_url must be http(s)" });
        continue;
      }
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 20000);
        const resp = await fetch(imageUrl, { signal: ctrl.signal, redirect: "follow" });
        clearTimeout(t);
        if (!resp.ok) throw new Error(`fetch ${resp.status}`);
        const ab = await resp.arrayBuffer();
        if (ab.byteLength > MAX_BYTES) throw new Error("image exceeds 5MB");
        bytes = new Uint8Array(ab);
      } catch (e) {
        results.push({ row: rowNum, course: course.title, status: "error", detail: `Could not fetch image (${e instanceof Error ? e.message : "error"})` });
        continue;
      }
    }
    const mime = detectMime(bytes);
    if (!mime || !ALLOWED.includes(mime)) {
      results.push({ row: rowNum, course: course.title, status: "error", detail: "Not a valid JPEG/PNG/WebP/GIF image" });
      continue;
    }

    // Upload once; reuse the same public URL for the course and its duplicates.
    const path = `${course.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extFor(mime)}`;
    const { error: upErr } = await service.storage.from(BUCKET).upload(path, bytes, { contentType: mime, upsert: false });
    if (upErr) {
      results.push({ row: rowNum, course: course.title, status: "error", detail: `Upload failed: ${upErr.message}` });
      continue;
    }
    const url = service.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

    const provenance = buildProvenanceColumns({
      sourceUrl: pick(row, "source_url", "sourceurl") || (filename ? "" : imageUrl),
      sourceName: pick(row, "source_name", "sourcename", "source"),
      license: pick(row, "license"),
      attribution: pick(row, "attribution", "credit"),
      origin: pick(row, "origin"),
    });
    const patch = { thumbnail_url: url, ...provenance, updated_at: new Date().toISOString() };

    const { error: updErr } = await service.from("courses").update(patch).eq("id", course.id);
    if (updErr) {
      await service.storage.from(BUCKET).remove([path]).catch(() => {});
      results.push({ row: rowNum, course: course.title, status: "error", detail: `Save failed: ${updErr.message}` });
      continue;
    }
    await removeOwned(service, course.thumbnail_url);
    updated++;

    // Apply to duplicate-titled courses (mirrored storefront copies).
    let dups = 0;
    if (applyDuplicates && course.title) {
      type Sibling = { id: string; thumbnail_url: string | null; title: string | null };
      const { data: siblings } = await service
        .from("courses")
        .select("id, thumbnail_url, title")
        .neq("id", course.id);
      const norm = (t: string) => t.trim().toLowerCase();
      const matches = ((siblings ?? []) as unknown as Sibling[]).filter((c) => !!c.title && norm(c.title) === norm(course.title));
      for (const sib of matches) {
        const { error: sErr } = await service.from("courses").update(patch).eq("id", sib.id);
        if (!sErr) { await removeOwned(service, sib.thumbnail_url); dups++; }
      }
      duplicatesUpdated += dups;
    }

    logAudit({
      userId: auth.user.id,
      action: "updated",
      entityType: "course",
      entityId: course.id,
      newValues: { thumbnail_url: url, ...provenance, via: "cover-import" },
    });
    results.push({ row: rowNum, course: course.title, status: "updated", detail: provenance.cover_license || provenance.cover_origin, duplicates_updated: dups });
  }

  return NextResponse.json({
    total_rows: rows.length,
    updated,
    duplicates_updated: duplicatesUpdated,
    skipped,
    errors: results.filter((r) => r.status === "error").length,
    results: results.slice(0, 1000),
  });
}
