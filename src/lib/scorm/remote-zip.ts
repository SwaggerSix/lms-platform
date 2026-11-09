/**
 * Read a zip archive by byte ranges instead of loading it whole.
 *
 * SCORM packages are often hundreds of MB (embedded video). Holding the zip
 * plus every inflated file in memory got the import function killed (OOM) on
 * a 382MB package, so extraction now reads the central directory and then
 * fetches/inflates one entry at a time. Memory use is bounded by the largest
 * entries in flight, not the package size.
 */
import { inflateRawSync } from "node:zlib";

/** Returns bytes [start, end) of the archive. */
export type RangeReader = (start: number, end: number) => Promise<Uint8Array>;

export interface ZipEntry {
  name: string;
  method: number;
  compressedSize: number;
  size: number;
  localHeaderOffset: number;
}

export class ZipFormatError extends Error {}

const EOCD_SIG = 0x06054b50;
const ZIP64_LOCATOR_SIG = 0x07064b50;
const ZIP64_EOCD_SIG = 0x06064b50;
const CDH_SIG = 0x02014b50;
const LFH_SIG = 0x04034b50;

function u64(view: DataView, off: number): number {
  const lo = view.getUint32(off, true);
  const hi = view.getUint32(off + 4, true);
  return hi * 0x100000000 + lo;
}

/** Read the central directory listing of a zip of `totalSize` bytes. */
export async function readZipEntries(read: RangeReader, totalSize: number): Promise<ZipEntry[]> {
  if (totalSize < 22) throw new ZipFormatError("File is too small to be a zip.");

  // EOCD is in the last 22 bytes + up to 65535 bytes of comment.
  const tailLen = Math.min(totalSize, 22 + 65535 + 20);
  const tailStart = totalSize - tailLen;
  const tail = await read(tailStart, totalSize);
  const tv = new DataView(tail.buffer, tail.byteOffset, tail.byteLength);

  let eocd = -1;
  for (let i = tail.length - 22; i >= 0; i--) {
    if (tv.getUint32(i, true) === EOCD_SIG) {
      eocd = i;
      break;
    }
  }
  if (eocd === -1) throw new ZipFormatError("Could not find the zip directory.");

  let count = tv.getUint16(eocd + 10, true);
  let cdSize = tv.getUint32(eocd + 12, true);
  let cdOffset = tv.getUint32(eocd + 16, true);

  // ZIP64: values saturated in the classic record; real ones live in the ZIP64 EOCD.
  if (count === 0xffff || cdSize === 0xffffffff || cdOffset === 0xffffffff) {
    const loc = eocd - 20;
    if (loc < 0 || tv.getUint32(loc, true) !== ZIP64_LOCATOR_SIG) {
      throw new ZipFormatError("Unsupported zip format.");
    }
    const z64Offset = u64(tv, loc + 8);
    const z64 = await read(z64Offset, z64Offset + 56);
    const zv = new DataView(z64.buffer, z64.byteOffset, z64.byteLength);
    if (zv.getUint32(0, true) !== ZIP64_EOCD_SIG) throw new ZipFormatError("Unsupported zip format.");
    count = u64(zv, 32);
    cdSize = u64(zv, 40);
    cdOffset = u64(zv, 48);
  }

  if (cdOffset + cdSize > totalSize) throw new ZipFormatError("The zip directory is corrupt.");
  const cd =
    cdOffset >= tailStart ? tail.subarray(cdOffset - tailStart, cdOffset - tailStart + cdSize) : await read(cdOffset, cdOffset + cdSize);
  const cv = new DataView(cd.buffer, cd.byteOffset, cd.byteLength);
  const decoder = new TextDecoder("utf-8");
  const latin1 = new TextDecoder("latin1");

  const entries: ZipEntry[] = [];
  let p = 0;
  for (let i = 0; i < count; i++) {
    if (p + 46 > cd.length || cv.getUint32(p, true) !== CDH_SIG) {
      throw new ZipFormatError("The zip directory is corrupt.");
    }
    const flags = cv.getUint16(p + 8, true);
    const method = cv.getUint16(p + 10, true);
    let compressedSize = cv.getUint32(p + 20, true);
    let size = cv.getUint32(p + 24, true);
    const nameLen = cv.getUint16(p + 28, true);
    const extraLen = cv.getUint16(p + 30, true);
    const commentLen = cv.getUint16(p + 32, true);
    let localHeaderOffset = cv.getUint32(p + 42, true);
    const nameBytes = cd.subarray(p + 46, p + 46 + nameLen);
    // Bit 11 = UTF-8 names; otherwise CP437 (latin1 is close enough for ASCII-safe checks).
    const name = (flags & 0x800 ? decoder : latin1).decode(nameBytes);

    // ZIP64 extended info extra field (0x0001), in order: size, csize, offset.
    let e = p + 46 + nameLen;
    const eEnd = e + extraLen;
    while (e + 4 <= eEnd) {
      const id = cv.getUint16(e, true);
      const len = cv.getUint16(e + 2, true);
      if (id === 0x0001) {
        let q = e + 4;
        if (size === 0xffffffff) { size = u64(cv, q); q += 8; }
        if (compressedSize === 0xffffffff) { compressedSize = u64(cv, q); q += 8; }
        if (localHeaderOffset === 0xffffffff) { localHeaderOffset = u64(cv, q); q += 8; }
      }
      e += 4 + len;
    }

    entries.push({ name, method, compressedSize, size, localHeaderOffset });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

/**
 * Fetch and inflate one entry. One range request in the common case: the local
 * header's name/extra lengths usually match the central directory's.
 */
export async function readZipEntry(read: RangeReader, entry: ZipEntry, totalSize: number): Promise<Uint8Array> {
  if (entry.method !== 0 && entry.method !== 8) {
    throw new ZipFormatError(`"${entry.name}" uses an unsupported zip compression method.`);
  }
  const guess = 30 + Buffer.byteLength(entry.name) + 1024 + entry.compressedSize;
  let chunk = await read(entry.localHeaderOffset, Math.min(totalSize, entry.localHeaderOffset + guess));
  const hv = new DataView(chunk.buffer, chunk.byteOffset, chunk.byteLength);
  if (chunk.length < 30 || hv.getUint32(0, true) !== LFH_SIG) {
    throw new ZipFormatError(`"${entry.name}" is corrupt in the zip.`);
  }
  const dataStart = 30 + hv.getUint16(26, true) + hv.getUint16(28, true);
  if (dataStart + entry.compressedSize > chunk.length) {
    const abs = entry.localHeaderOffset + dataStart;
    chunk = await read(abs, abs + entry.compressedSize);
  } else {
    chunk = chunk.subarray(dataStart, dataStart + entry.compressedSize);
  }

  if (entry.method === 0) {
    if (chunk.length !== entry.size) throw new ZipFormatError(`"${entry.name}" is corrupt in the zip.`);
    return chunk;
  }
  let out: Buffer;
  try {
    out = inflateRawSync(chunk, { maxOutputLength: Math.max(entry.size, 1) });
  } catch {
    throw new ZipFormatError(`"${entry.name}" could not be decompressed.`);
  }
  if (out.length !== entry.size) throw new ZipFormatError(`"${entry.name}" is corrupt in the zip.`);
  return new Uint8Array(out.buffer, out.byteOffset, out.byteLength);
}

/** Range reader over an in-memory buffer (small direct uploads, tests). */
export function memoryReader(buf: Uint8Array): RangeReader {
  return async (start, end) => buf.subarray(start, end);
}

/**
 * Range reader over an HTTP URL that supports Range requests (a Supabase
 * signed URL). Returns the reader and the total size.
 */
export async function httpReader(url: string): Promise<{ read: RangeReader; size: number }> {
  const get = async (start: number, end: number, attempt = 0): Promise<Response> => {
    const res = await fetch(url, { headers: { Range: `bytes=${start}-${end - 1}` } });
    if (res.status === 206 || (res.status === 200 && start === 0)) return res;
    if (attempt < 2 && res.status >= 500) {
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
      return get(start, end, attempt + 1);
    }
    throw new Error(`Range request failed (${res.status})`);
  };

  const probe = await get(0, 1);
  const contentRange = probe.headers.get("content-range") ?? "";
  const total = Number(contentRange.split("/")[1]);
  await probe.arrayBuffer().catch(() => {});
  if (!Number.isFinite(total) || total <= 0) throw new Error("Could not read the uploaded file size.");

  const read: RangeReader = async (start, end) => {
    if (end <= start) return new Uint8Array(0);
    const res = await get(start, end);
    const buf = new Uint8Array(await res.arrayBuffer());
    // A server that ignored Range would return the whole file.
    return res.status === 200 ? buf.subarray(start, end) : buf;
  };
  return { read, size: total };
}
