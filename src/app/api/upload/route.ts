import { createClient } from "@/lib/supabase/server";
import { authorize } from "@/lib/auth/authorize";
import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import {
  type StorageBucket,
  BUCKET_LIMITS,
  BUCKET_MIME_TYPES,
  generateFilePath,
} from "@/lib/storage";

const VALID_BUCKETS: StorageBucket[] = [
  "documents",
  "course-content",
  "avatars",
  "branding",
];

function isValidBucket(bucket: string): bucket is StorageBucket {
  return VALID_BUCKETS.includes(bucket as StorageBucket);
}

/**
 * Validate file magic bytes against the claimed MIME type.
 * Returns true if the bytes match or if we don't have a signature for the type.
 */
function validateMagicBytes(buffer: ArrayBuffer, claimedType: string): boolean {
  const bytes = new Uint8Array(buffer.slice(0, 8));

  const signatures: Record<string, number[]> = {
    "image/jpeg": [0xff, 0xd8, 0xff],
    "image/png": [0x89, 0x50, 0x4e, 0x47],
    "application/pdf": [0x25, 0x50, 0x44, 0x46],
    "application/zip": [0x50, 0x4b, 0x03, 0x04],
  };

  const sig = signatures[claimedType];
  if (!sig) return true; // No signature to check, allow

  return sig.every((byte, i) => bytes[i] === byte);
}

/**
 * POST /api/upload
 * Accepts multipart form data and uploads a file to Supabase Storage.
 *
 * Form fields:
 *   file     - the File to upload (required)
 *   bucket   - storage bucket name (default: "documents")
 *   folder   - optional folder/prefix path
 *   folderId - optional folder id for path generation
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();

  // Authenticate
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Rate limit: 20 uploads per minute per user
  const { success } = await rateLimit(`upload:${user.id}`, 20, 60000);
  if (!success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Invalid form data" },
      { status: 400 }
    );
  }

  const file = formData.get("file") as File | null;
  const bucketParam = (formData.get("bucket") as string) || "documents";
  const folder = (formData.get("folder") as string) || "";
  const folderId = (formData.get("folderId") as string) || undefined;

  // Validate file presence
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  // Validate bucket
  if (!isValidBucket(bucketParam)) {
    return NextResponse.json(
      { error: `Invalid bucket "${bucketParam}". Allowed: ${VALID_BUCKETS.join(", ")}` },
      { status: 400 }
    );
  }

  const bucket = bucketParam as StorageBucket;

  // Validate file size
  const maxSize = BUCKET_LIMITS[bucket];
  if (file.size > maxSize) {
    const maxMB = Math.round(maxSize / (1024 * 1024));
    return NextResponse.json(
      { error: `File too large. Maximum size is ${maxMB}MB.` },
      { status: 400 }
    );
  }

  // Validate MIME type
  const allowedTypes = BUCKET_MIME_TYPES[bucket];
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json(
      {
        error: `File type "${file.type}" is not allowed. Accepted: ${allowedTypes.map((t) => t.split("/")[1]).join(", ")}`,
      },
      { status: 400 }
    );
  }

  // Validate magic bytes match the claimed MIME type
  const fileBuffer = await file.arrayBuffer();
  if (!validateMagicBytes(fileBuffer, file.type)) {
    return NextResponse.json(
      { error: "File content does not match the declared file type." },
      { status: 400 }
    );
  }

  // Sanitize folder to prevent path traversal
  const cleanFolder = folder.replace(/[^a-zA-Z0-9_\-\/]/g, "").replace(/\.\./g, "");

  // Build storage path
  let fileName: string;
  if (cleanFolder) {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const cleanName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_").replace(/_{2,}/g, "_");
    fileName = `${cleanFolder}/${timestamp}-${random}-${cleanName}`;
  } else {
    fileName = generateFilePath(bucket, file.name, {
      userId: user.id,
      folderId,
    });
  }

  // Upload to Supabase Storage (use buffer since we already read it for validation)
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(fileName, fileBuffer, {
      cacheControl: "3600",
      contentType: file.type,
      upsert: false,
    });

  if (error) {
    console.error("Upload API error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from(bucket)
    .getPublicUrl(data.path);

  return NextResponse.json({
    path: data.path,
    url: urlData.publicUrl,
    size: file.size,
    mimeType: file.type,
    fileName: file.name,
  });
}

/**
 * DELETE /api/upload
 * Removes a file from Supabase Storage.
 *
 * Query params:
 *   bucket - storage bucket name (required)
 *   path   - file path within the bucket (required)
 */
export async function DELETE(request: NextRequest) {
  const auth = await authorize("admin");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabase = await createClient();

  const { searchParams } = new URL(request.url);
  const bucket = searchParams.get("bucket");
  const path = searchParams.get("path");

  if (!bucket || !path) {
    return NextResponse.json(
      { error: "Both 'bucket' and 'path' query parameters are required" },
      { status: 400 }
    );
  }

  if (!isValidBucket(bucket)) {
    return NextResponse.json(
      { error: `Invalid bucket "${bucket}". Allowed: ${VALID_BUCKETS.join(", ")}` },
      { status: 400 }
    );
  }

  const { error } = await supabase.storage
    .from(bucket)
    .remove([path]);

  if (error) {
    console.error("Upload API error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ message: "File deleted", path });
}
