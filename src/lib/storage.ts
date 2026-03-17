/**
 * Supabase Storage helper for file uploads.
 * Handles document repository files, course content, avatars, and logos.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type StorageBucket = "documents" | "course-content" | "avatars" | "branding";

/** Maximum file sizes per bucket (in bytes) */
export const BUCKET_LIMITS: Record<StorageBucket, number> = {
  documents: 50 * 1024 * 1024,   // 50MB
  "course-content": 500 * 1024 * 1024, // 500MB (for video/SCORM)
  avatars: 2 * 1024 * 1024,       // 2MB
  branding: 5 * 1024 * 1024,      // 5MB
};

/** Allowed MIME types per bucket */
export const BUCKET_MIME_TYPES: Record<StorageBucket, string[]> = {
  documents: [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "image/jpeg",
    "image/png",
    "image/gif",
    "text/plain",
    "text/csv",
  ],
  "course-content": [
    "video/mp4",
    "video/webm",
    "application/zip",
    "application/x-zip-compressed",
    "application/pdf",
    "image/jpeg",
    "image/png",
    "audio/mpeg",
    "audio/wav",
  ],
  avatars: ["image/jpeg", "image/png", "image/webp"],
  branding: ["image/jpeg", "image/png", "image/svg+xml", "image/x-icon", "image/webp"],
};

export interface UploadResult {
  success: boolean;
  path?: string;
  url?: string;
  error?: string;
  size?: number;
  mimeType?: string;
}

/**
 * Validate a file before upload.
 */
export function validateFile(
  file: File,
  bucket: StorageBucket
): { valid: boolean; error?: string } {
  const maxSize = BUCKET_LIMITS[bucket];
  const allowedTypes = BUCKET_MIME_TYPES[bucket];

  if (file.size > maxSize) {
    const maxMB = Math.round(maxSize / (1024 * 1024));
    return { valid: false, error: `File too large. Maximum size is ${maxMB}MB.` };
  }

  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: `File type "${file.type}" is not allowed. Accepted types: ${allowedTypes.map((t) => t.split("/")[1]).join(", ")}`,
    };
  }

  return { valid: true };
}

/**
 * Generate a unique file path for storage.
 */
export function generateFilePath(
  bucket: StorageBucket,
  fileName: string,
  options?: { orgId?: string; userId?: string; folderId?: string }
): string {
  const ext = fileName.split(".").pop() || "";
  const cleanName = fileName
    .replace(/[^a-zA-Z0-9.-]/g, "_")
    .replace(/_{2,}/g, "_");
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);

  const parts: string[] = [];

  if (options?.orgId) parts.push(options.orgId);
  if (options?.folderId) parts.push(options.folderId);
  if (options?.userId) parts.push(options.userId);

  parts.push(`${timestamp}-${random}-${cleanName}`);

  return parts.join("/");
}

/**
 * Upload a file to Supabase Storage.
 */
export async function uploadFile(
  supabase: SupabaseClient,
  bucket: StorageBucket,
  file: File,
  options?: {
    orgId?: string;
    userId?: string;
    folderId?: string;
    upsert?: boolean;
  }
): Promise<UploadResult> {
  // Validate
  const validation = validateFile(file, bucket);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  // Generate path
  const path = generateFilePath(bucket, file.name, options);

  // Upload
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, file, {
      cacheControl: "3600",
      upsert: options?.upsert ?? false,
      contentType: file.type,
    });

  if (error) {
    return { success: false, error: error.message };
  }

  // Get public URL
  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);

  return {
    success: true,
    path,
    url: urlData.publicUrl,
    size: file.size,
    mimeType: file.type,
  };
}

/**
 * Delete a file from Supabase Storage.
 */
export async function deleteFile(
  supabase: SupabaseClient,
  bucket: StorageBucket,
  path: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.storage.from(bucket).remove([path]);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Generate a signed URL for private file access.
 */
export async function getSignedUrl(
  supabase: SupabaseClient,
  bucket: StorageBucket,
  path: string,
  expiresInSeconds: number = 3600
): Promise<{ url?: string; error?: string }> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresInSeconds);

  if (error) {
    return { error: error.message };
  }

  return { url: data.signedUrl };
}
