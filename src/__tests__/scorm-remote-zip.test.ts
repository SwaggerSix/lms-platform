import { describe, it, expect } from "vitest";
import { randomBytes as nodeRandomBytes } from "node:crypto";
import { zipSync, strToU8 } from "fflate";
import { readZipEntries, readZipEntry, memoryReader, ZipFormatError, type RangeReader } from "@/lib/scorm/remote-zip";
import { extractAndStorePackageFrom } from "@/lib/scorm/extract";

// Incompressible data, so the zip is far larger than the ~64KB tail scan.
function randomBytes(n: number) {
  return new Uint8Array(nodeRandomBytes(n));
}

/** Memory reader that records the largest single range requested. */
function trackingReader(buf: Uint8Array) {
  const stats = { maxRequest: 0, totalRead: 0, requests: 0 };
  const read: RangeReader = async (s, e) => {
    stats.maxRequest = Math.max(stats.maxRequest, e - s);
    stats.totalRead += e - s;
    stats.requests++;
    return buf.subarray(s, e);
  };
  return { read, stats };
}

describe("remote zip reader", () => {
  const files = {
    "imsmanifest.xml": strToU8('<manifest><resources><resource identifier="r" href="index.html"/></resources></manifest>'),
    "index.html": strToU8("<html>hello</html>".repeat(200)),
    "media/a.bin": randomBytes(300_000),
    "media/b.bin": randomBytes(250_000),
    "stored.txt": strToU8("not compressed"),
  };
  const zip = zipSync({ ...files, "stored.txt": [files["stored.txt"], { level: 0 }] } as any);

  it("lists entries from the central directory", async () => {
    const entries = await readZipEntries(memoryReader(zip), zip.length);
    expect(entries.map((e) => e.name).sort()).toEqual(Object.keys(files).sort());
    const stored = entries.find((e) => e.name === "stored.txt")!;
    expect(stored.method).toBe(0);
    expect(entries.find((e) => e.name === "index.html")!.method).toBe(8);
  });

  it("reads deflated and stored entries byte-for-byte", async () => {
    const read = memoryReader(zip);
    const entries = await readZipEntries(read, zip.length);
    for (const entry of entries) {
      const out = await readZipEntry(read, entry, zip.length);
      expect(Buffer.from(out).equals(Buffer.from(files[entry.name as keyof typeof files]))).toBe(true);
    }
  });

  it("never requests much more than one entry at a time", async () => {
    const { read, stats } = trackingReader(zip);
    const entries = await readZipEntries(read, zip.length);
    const biggest = Math.max(...entries.map((e) => e.compressedSize));
    for (const entry of entries) await readZipEntry(read, entry, zip.length);
    // Tail scan is bounded at ~64KB; per-entry reads add ~1KB of header slack.
    expect(stats.maxRequest).toBeLessThanOrEqual(Math.max(biggest + 2048, 22 + 65535 + 20));
    expect(stats.maxRequest).toBeLessThan(zip.length);
  });

  it("rejects non-zips", async () => {
    const junk = randomBytes(1000);
    await expect(readZipEntries(memoryReader(junk), junk.length)).rejects.toBeInstanceOf(ZipFormatError);
  });

  it("extracts via ranges end to end", async () => {
    const uploads: string[] = [];
    const service = {
      storage: {
        from: () => ({
          upload: async (key: string) => {
            uploads.push(key);
            return { error: null };
          },
        }),
      },
    } as any;
    const { read, stats } = trackingReader(zip);
    const pkg = await extractAndStorePackageFrom(service, read, zip.length);
    expect(pkg.fileCount).toBe(5);
    expect(pkg.launchUrl).toBe(`/scorm-content/${pkg.packageId}/index.html`);
    expect(uploads).toHaveLength(5);
    expect(stats.maxRequest).toBeLessThan(zip.length);
  });
});
