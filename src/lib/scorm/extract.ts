import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { unzipSync, strFromU8 } from "fflate";
import {
  MAX_ENTRIES,
  MAX_UNCOMPRESSED_BYTES,
  MAX_ZIP_BYTES,
  SCORM_BUCKET,
  SCORM_PREFIX,
  buildContentUrl,
  contentTypeFor,
  invalidStorageKeys,
  normalizeEntryPath,
  resolveLaunch,
  type ScormVersion,
} from "./package";

export class ScormPackageError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

export interface ExtractedPackage {
  packageId: string;
  launchUrl: string;
  version: ScormVersion;
  title: string | null;
  fileCount: number;
  totalBytes: number;
}

/** Upload with bounded concurrency; aborts on the first failure. */
async function uploadAll(
  service: SupabaseClient,
  prefix: string,
  entries: Array<[string, Uint8Array]>,
  concurrency = 8
) {
  let next = 0;
  let failure = null as string | null;
  const worker = async () => {
    while (failure === null) {
      const i = next++;
      if (i >= entries.length) return;
      const [path, bytes] = entries[i];
      const key = `${prefix}/${path}`;
      let lastErr = "";
      for (let attempt = 0; attempt < 3; attempt++) {
        const { error } = await service.storage.from(SCORM_BUCKET).upload(key, bytes, {
          contentType: contentTypeFor(path),
          upsert: true,
          cacheControl: "3600",
        });
        if (!error) {
          lastErr = "";
          break;
        }
        lastErr = error.message;
        // Size-limit errors won't succeed on retry.
        if (/maximum allowed size|too large|payload/i.test(lastErr)) break;
        await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
      }
      if (lastErr) {
        failure = `${path}: ${lastErr}`;
        return;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, entries.length) }, worker));
  if (failure) {
    console.error("SCORM extract upload error:", failure);
    const tooBig = /maximum allowed size|too large/i.test(failure);
    throw new ScormPackageError(
      tooBig
        ? `A file in the package is larger than the storage upload limit (${failure.split(":")[0]}). Raise the upload file size limit in Supabase → Storage → Settings.`
        : "Failed to store the package files. Please try again.",
      tooBig ? 400 : 500
    );
  }
}

/**
 * Validate, unzip and store a SCORM package. Each upload gets a fresh
 * package id, so replacing a lesson's package never overwrites files a
 * learner pinned to an older course version may still be using.
 */
export async function extractAndStorePackage(
  service: SupabaseClient,
  zip: Uint8Array
): Promise<ExtractedPackage> {
  if (zip.length > MAX_ZIP_BYTES) {
    throw new ScormPackageError(`SCORM package is too large (max ${Math.round(MAX_ZIP_BYTES / 1024 / 1024)}MB).`);
  }
  if (zip.length < 4 || zip[0] !== 0x50 || zip[1] !== 0x4b) {
    throw new ScormPackageError("File is not a valid .zip package.");
  }

  let uncompressed = 0;
  let count = 0;
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(zip, {
      filter: (f) => {
        if (!normalizeEntryPath(f.name)) return false;
        count++;
        uncompressed += f.originalSize;
        if (count > MAX_ENTRIES || uncompressed > MAX_UNCOMPRESSED_BYTES) {
          throw new ScormPackageError("The package is too large once unzipped.");
        }
        return true;
      },
    });
  } catch (e) {
    if (e instanceof ScormPackageError) throw e;
    throw new ScormPackageError("Could not read the .zip package. Re-export it from your authoring tool and try again.");
  }

  const entries: Array<[string, Uint8Array]> = [];
  for (const [raw, bytes] of Object.entries(files)) {
    const p = normalizeEntryPath(raw);
    if (p) entries.push([p, bytes]);
  }
  if (entries.length === 0) throw new ScormPackageError("The package is empty.");

  const paths = entries.map(([p]) => p);
  const bad = invalidStorageKeys(paths);
  if (bad.length > 0) {
    throw new ScormPackageError(
      `Some file names contain characters storage can't accept (e.g. "${bad[0]}"). Rename them using plain letters, numbers, dashes and underscores, then re-export.`
    );
  }

  const byPath = new Map(entries);
  const launch = resolveLaunch(paths, (p) => {
    const b = byPath.get(p);
    return b ? strFromU8(b) : null;
  });
  if (!launch) {
    throw new ScormPackageError("Could not find a launch file (imsmanifest.xml or index.html) in the package.");
  }

  const packageId = crypto.randomUUID();
  await uploadAll(service, `${SCORM_PREFIX}/${packageId}`, entries);

  return {
    packageId,
    launchUrl: buildContentUrl(packageId, launch.launchPath, launch.launchQuery),
    version: launch.version,
    title: launch.title,
    fileCount: entries.length,
    totalBytes: uncompressed,
  };
}
