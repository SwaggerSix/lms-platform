/**
 * Rules for uploaded cover images (course covers and learning-path images).
 * One place, so the two upload routes can't drift apart.
 */

export const COVER_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
export const COVER_IMAGE_MAX_BYTES = 5 * 1024 * 1024; // 5MB

/** Validate image magic bytes against the claimed MIME type. */
export function validImageBytes(buffer: ArrayBuffer, claimedType: string): boolean {
  const b = new Uint8Array(buffer.slice(0, 12));
  switch (claimedType) {
    case "image/jpeg":
      return b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
    case "image/png":
      return b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
    case "image/gif":
      return b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38;
    case "image/webp":
      // "RIFF" .... "WEBP"
      return (
        b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
        b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50
      );
    default:
      return false;
  }
}
