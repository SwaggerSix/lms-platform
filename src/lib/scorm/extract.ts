import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
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
import { ZipFormatError, memoryReader, readZipEntries, readZipEntry, type RangeReader, type ZipEntry } from "./remote-zip";

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

/**
 * Max bytes (compressed + inflated) of entries being processed at once. Keeps
 * peak memory far below the function limit regardless of package size; a
 * single entry bigger than this still runs, just alone.
 */
const IN_FLIGHT_BUDGET = 192 * 1024 * 1024;
const CONCURRENCY = 8;

async function uploadOne(service: SupabaseClient, key: string, path: string, bytes: Uint8Array) {
  let lastErr = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    const { error } = await service.storage.from(SCORM_BUCKET).upload(key, bytes, {
      contentType: contentTypeFor(path),
      upsert: true,
      cacheControl: "3600",
    });
    if (!error) return;
    lastErr = error.message;
    if (/maximum allowed size|too large|payload/i.test(lastErr)) break;
    await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
  }
  console.error("SCORM extract upload error:", `${path}: ${lastErr}`);
  const tooBig = /maximum allowed size|too large/i.test(lastErr);
  throw new ScormPackageError(
    tooBig
      ? `A file in the package is larger than the storage upload limit (${path}). Raise the upload file size limit in Supabase → Storage → Settings.`
      : "Failed to store the package files. Please try again.",
    tooBig ? 400 : 500
  );
}

/**
 * Validate, unzip and store a SCORM package read through `read`. Each upload
 * gets a fresh package id, so replacing a lesson's package never overwrites
 * files a learner pinned to an older course version may still be using.
 */
export async function extractAndStorePackageFrom(
  service: SupabaseClient,
  read: RangeReader,
  totalSize: number
): Promise<ExtractedPackage> {
  if (totalSize > MAX_ZIP_BYTES) {
    throw new ScormPackageError(`SCORM package is too large (max ${Math.round(MAX_ZIP_BYTES / 1024 / 1024)}MB).`);
  }
  const head = await read(0, Math.min(4, totalSize));
  if (head.length < 4 || head[0] !== 0x50 || head[1] !== 0x4b) {
    throw new ScormPackageError("File is not a valid .zip package.");
  }

  let rawEntries: ZipEntry[];
  try {
    rawEntries = await readZipEntries(read, totalSize);
  } catch (e) {
    if (e instanceof ZipFormatError) {
      throw new ScormPackageError(`${e.message} Re-export it from your authoring tool and try again.`);
    }
    throw e;
  }

  const entries: Array<{ path: string; entry: ZipEntry }> = [];
  let uncompressed = 0;
  for (const entry of rawEntries) {
    const path = normalizeEntryPath(entry.name);
    if (!path) continue;
    entries.push({ path, entry });
    uncompressed += entry.size;
  }
  if (entries.length === 0) throw new ScormPackageError("The package is empty.");
  if (entries.length > MAX_ENTRIES || uncompressed > MAX_UNCOMPRESSED_BYTES) {
    throw new ScormPackageError("The package is too large once unzipped.");
  }

  const paths = entries.map((e) => e.path);
  const bad = invalidStorageKeys(paths);
  if (bad.length > 0) {
    throw new ScormPackageError(
      `Some file names contain characters storage can't accept (e.g. "${bad[0]}"). Rename them using plain letters, numbers, dashes and underscores, then re-export.`
    );
  }

  // Only the manifest is needed up front to find the launch file.
  const byPath = new Map(entries.map((e) => [e.path, e.entry]));
  const manifestPath = paths
    .filter((p) => p.toLowerCase().endsWith("imsmanifest.xml"))
    .sort((a, b) => a.split("/").length - b.split("/").length)[0];
  let manifestText: string | null = null;
  if (manifestPath) {
    try {
      manifestText = new TextDecoder().decode(await readZipEntry(read, byPath.get(manifestPath)!, totalSize));
    } catch {
      manifestText = null;
    }
  }
  const launch = resolveLaunch(paths, (p) => (p === manifestPath ? manifestText : null));
  if (!launch) {
    throw new ScormPackageError("Could not find a launch file (imsmanifest.xml or index.html) in the package.");
  }

  const packageId = crypto.randomUUID();
  const prefix = `${SCORM_PREFIX}/${packageId}`;

  // Bounded concurrency + bounded bytes in flight.
  let next = 0;
  let inFlight = 0;
  let failure: unknown = null;
  const waiters: Array<() => void> = [];
  const release = (n: number) => {
    inFlight -= n;
    waiters.splice(0).forEach((w) => w());
  };
  const acquire = async (n: number) => {
    while (failure === null && inFlight > 0 && inFlight + n > IN_FLIGHT_BUDGET) {
      await new Promise<void>((r) => waiters.push(r));
    }
    inFlight += n;
  };

  const worker = async () => {
    while (failure === null) {
      const i = next++;
      if (i >= entries.length) return;
      const { path, entry } = entries[i];
      const cost = entry.compressedSize + entry.size;
      await acquire(cost);
      try {
        if (failure !== null) return;
        const bytes = await readZipEntry(read, entry, totalSize);
        await uploadOne(service, `${prefix}/${path}`, path, bytes);
      } catch (e) {
        failure ??= e;
      } finally {
        release(cost);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, entries.length) }, worker));

  if (failure !== null) {
    if (failure instanceof ScormPackageError) throw failure;
    if (failure instanceof ZipFormatError) throw new ScormPackageError(failure.message);
    console.error("SCORM extract error:", failure);
    throw new ScormPackageError("Failed to store the package files. Please try again.", 500);
  }

  return {
    packageId,
    launchUrl: buildContentUrl(packageId, launch.launchPath, launch.launchQuery),
    version: launch.version,
    title: launch.title,
    fileCount: entries.length,
    totalBytes: uncompressed,
  };
}

/** In-memory variant for small direct uploads. */
export async function extractAndStorePackage(service: SupabaseClient, zip: Uint8Array): Promise<ExtractedPackage> {
  return extractAndStorePackageFrom(service, memoryReader(zip), zip.length);
}
