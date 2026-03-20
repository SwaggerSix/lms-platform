import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/auth/authorize";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * GET /api/teams/manifest
 * Download the Teams app manifest as a ZIP file.
 * The ZIP contains manifest.json and placeholder icon files.
 */
export async function GET(request: NextRequest) {
  const auth = await authorize("admin");
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    // Read the manifest file
    const manifestPath = join(process.cwd(), "public", "teams-manifest.json");
    const manifestContent = readFileSync(manifestPath, "utf-8");

    // Build a minimal ZIP file containing the manifest
    // For a proper ZIP, we include the manifest and placeholder icons
    const zipBuffer = buildManifestZip(manifestContent);

    return new NextResponse(new Uint8Array(zipBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": 'attachment; filename="learnhub-teams-app.zip"',
        "Content-Length": zipBuffer.byteLength.toString(),
      },
    });
  } catch (err: any) {
    console.error("Error generating Teams manifest ZIP:", err);
    return NextResponse.json(
      { error: "Failed to generate manifest package" },
      { status: 500 }
    );
  }
}

// ─── Minimal ZIP Builder ────────────────────────────────────────

/**
 * Build a minimal ZIP file containing the Teams manifest and placeholder icons.
 * Uses basic ZIP format (stored, no compression) to avoid external dependencies.
 */
function buildManifestZip(manifestJson: string): Buffer {
  const files: Array<{ name: string; data: Buffer }> = [
    { name: "manifest.json", data: Buffer.from(manifestJson, "utf-8") },
    { name: "icons/color-192x192.png", data: createPlaceholderPng(192) },
    { name: "icons/outline-32x32.png", data: createPlaceholderPng(32) },
  ];

  // Build ZIP in memory
  const localHeaders: Buffer[] = [];
  const centralHeaders: Buffer[] = [];
  let offset = 0;

  for (const file of files) {
    const nameBuffer = Buffer.from(file.name, "utf-8");
    const crc = crc32(file.data);

    // Local file header
    const local = Buffer.alloc(30 + nameBuffer.length);
    local.writeUInt32LE(0x04034b50, 0); // Signature
    local.writeUInt16LE(20, 4); // Version needed
    local.writeUInt16LE(0, 6); // Flags
    local.writeUInt16LE(0, 8); // Compression (stored)
    local.writeUInt16LE(0, 10); // Mod time
    local.writeUInt16LE(0, 12); // Mod date
    local.writeUInt32LE(crc, 14); // CRC-32
    local.writeUInt32LE(file.data.length, 18); // Compressed size
    local.writeUInt32LE(file.data.length, 22); // Uncompressed size
    local.writeUInt16LE(nameBuffer.length, 26); // Name length
    local.writeUInt16LE(0, 28); // Extra length
    nameBuffer.copy(local, 30);

    localHeaders.push(local);
    localHeaders.push(file.data);

    // Central directory header
    const central = Buffer.alloc(46 + nameBuffer.length);
    central.writeUInt32LE(0x02014b50, 0); // Signature
    central.writeUInt16LE(20, 4); // Version made by
    central.writeUInt16LE(20, 6); // Version needed
    central.writeUInt16LE(0, 8); // Flags
    central.writeUInt16LE(0, 10); // Compression
    central.writeUInt16LE(0, 12); // Mod time
    central.writeUInt16LE(0, 14); // Mod date
    central.writeUInt32LE(crc, 16); // CRC-32
    central.writeUInt32LE(file.data.length, 20); // Compressed size
    central.writeUInt32LE(file.data.length, 24); // Uncompressed size
    central.writeUInt16LE(nameBuffer.length, 28); // Name length
    central.writeUInt16LE(0, 30); // Extra length
    central.writeUInt16LE(0, 32); // Comment length
    central.writeUInt16LE(0, 34); // Disk number
    central.writeUInt16LE(0, 36); // Internal attributes
    central.writeUInt32LE(0, 38); // External attributes
    central.writeUInt32LE(offset, 42); // Local header offset
    nameBuffer.copy(central, 46);

    centralHeaders.push(central);

    offset += local.length + file.data.length;
  }

  const centralDirOffset = offset;
  const centralDirSize = centralHeaders.reduce((s, b) => s + b.length, 0);

  // End of central directory
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); // Signature
  eocd.writeUInt16LE(0, 4); // Disk number
  eocd.writeUInt16LE(0, 6); // Central dir disk
  eocd.writeUInt16LE(files.length, 8); // Entries on disk
  eocd.writeUInt16LE(files.length, 10); // Total entries
  eocd.writeUInt32LE(centralDirSize, 12); // Central dir size
  eocd.writeUInt32LE(centralDirOffset, 16); // Central dir offset
  eocd.writeUInt16LE(0, 20); // Comment length

  return Buffer.concat([...localHeaders, ...centralHeaders, eocd]);
}

/**
 * Create a minimal valid 1x1 PNG as a placeholder icon.
 * In production, replace these with actual branded icons.
 */
function createPlaceholderPng(size: number): Buffer {
  // Minimal 1x1 purple PNG (the actual size metadata is in the IHDR)
  // This is a valid PNG that Teams will accept as a placeholder
  const ihdr = Buffer.from([
    0x00, 0x00, 0x00, 0x0d, // Length: 13
    0x49, 0x48, 0x44, 0x52, // "IHDR"
    0x00, 0x00, 0x00, 0x01, // Width: 1
    0x00, 0x00, 0x00, 0x01, // Height: 1
    0x08, 0x02, // 8-bit RGB
    0x00, 0x00, 0x00, // Compression, filter, interlace
    0x90, 0x77, 0x53, 0xde, // CRC
  ]);

  const idat = Buffer.from([
    0x00, 0x00, 0x00, 0x0c, // Length: 12
    0x49, 0x44, 0x41, 0x54, // "IDAT"
    0x08, 0xd7, 0x63, 0x68, // Compressed data (purple pixel)
    0x60, 0xf8, 0x0f, 0x00,
    0x01, 0x01, 0x00, 0x05, // ...
    0x18, 0xd8, 0x4e, 0x2e, // CRC
  ]);

  const iend = Buffer.from([
    0x00, 0x00, 0x00, 0x00, // Length: 0
    0x49, 0x45, 0x4e, 0x44, // "IEND"
    0xae, 0x42, 0x60, 0x82, // CRC
  ]);

  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  return Buffer.concat([signature, ihdr, idat, iend]);
}

// ─── CRC32 ──────────────────────────────────────────────────────

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}
