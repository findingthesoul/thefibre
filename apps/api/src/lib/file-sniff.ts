// What a file IS, read from its bytes — and an image's metadata removed —
// for the community page's uploaded documents (item 4, 2026-10-14).
//
// The type is read from the content, never from the extension or the
// browser's claim: both are typed by whoever uploads, and a document a whole
// community downloads must be what it says. Four kinds, by their magic bytes.
//
// Metadata is stripped WITHOUT re-encoding, by dropping the segments that
// carry it: a phone photo of a flyer carries the GPS position of the
// person's kitchen in its EXIF, and members download it. No image library:
// the API image carries no native dependency for this, and these formats
// keep metadata in well-defined, skippable blocks.

export type SniffedKind = 'pdf' | 'png' | 'jpeg' | 'webp';

export const MIME: Record<SniffedKind, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
};

export const EXT: Record<SniffedKind, string> = { pdf: 'pdf', png: 'png', jpeg: 'jpg', webp: 'webp' };

const startsWith = (b: Uint8Array, sig: number[], at = 0) => sig.every((v, i) => b[at + i] === v);

/** The kind, from the first bytes; null for anything else. */
export function sniff(bytes: Uint8Array): SniffedKind | null {
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) return 'pdf'; // %PDF-
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png';
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'jpeg';
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)) return 'webp'; // RIFF….WEBP
  return null;
}

/** The EXIF Orientation (1–8) inside an APP1 payload, or null. Reads the
 *  TIFF header's byte order and walks IFD0 for tag 0x0112 — nothing else. */
function exifOrientation(payload: Uint8Array): number | null {
  if (payload.length < 14 || String.fromCharCode(...payload.subarray(0, 4)) !== 'Exif') return null;
  const t = payload.subarray(6); // TIFF header
  const le = t[0] === 0x49 && t[1] === 0x49; // "II" little-endian, else "MM"
  const u16 = (o: number) => (le ? t[o]! | (t[o + 1]! << 8) : (t[o]! << 8) | t[o + 1]!);
  const u32 = (o: number) => (le ? u16(o) + u16(o + 2) * 65536 : u16(o) * 65536 + u16(o + 2));
  if (t.length < 8) return null;
  const ifd = u32(4);
  if (ifd + 2 > t.length) return null;
  const count = u16(ifd);
  for (let k = 0; k < count; k += 1) {
    const e = ifd + 2 + k * 12;
    if (e + 12 > t.length) return null;
    if (u16(e) === 0x0112) {
      const v = u16(e + 8);
      return v >= 1 && v <= 8 ? v : null;
    }
  }
  return null;
}

/** A minimal APP1 carrying ONLY the orientation: dropping it entirely would
 *  turn every portrait phone photo on its side, and the orientation says
 *  nothing about where or when a photo was taken. */
function orientationOnlyApp1(orientation: number): number[] {
  const tiff = [
    0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00, // "II*\0", IFD0 at 8
    0x01, 0x00, // one entry
    0x12, 0x01, 0x03, 0x00, 0x01, 0x00, 0x00, 0x00, orientation, 0x00, 0x00, 0x00, // 0x0112 SHORT ×1
    0x00, 0x00, 0x00, 0x00, // no next IFD
  ];
  const payload = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00, ...tiff]; // "Exif\0\0"
  const len = payload.length + 2;
  return [0xff, 0xe1, (len >> 8) & 0xff, len & 0xff, ...payload];
}

/** JPEG: drop APP1 (Exif, XMP), APP13 (IPTC/Photoshop) and COM segments,
 *  keeping only the orientation. Everything from the start-of-scan on is
 *  image data and copied as is. Null when the file is not a whole JPEG — a
 *  segment running past the end, no start-of-scan, no end-of-image. */
function stripJpeg(b: Uint8Array): Uint8Array | null {
  const out: number[] = [0xff, 0xd8];
  let i = 2;
  let orientation: number | null = null;
  let sawScan = false;
  while (i + 4 <= b.length) {
    if (b[i] !== 0xff) return null;
    const marker = b[i + 1]!;
    if (marker === 0xda) {
      sawScan = true;
      break;
    }
    const len = (b[i + 2]! << 8) | b[i + 3]!;
    const end = i + 2 + len;
    if (len < 2 || end > b.length) return null;
    if (marker === 0xe1) orientation ??= exifOrientation(b.subarray(i + 4, end));
    const drop = marker === 0xe1 || marker === 0xed || marker === 0xfe;
    if (!drop) for (let k = i; k < end; k += 1) out.push(b[k]!);
    i = end;
  }
  if (!sawScan || b[b.length - 2] !== 0xff || b[b.length - 1] !== 0xd9) return null;
  // Right after SOI, where readers look for it.
  if (orientation && orientation !== 1) out.splice(2, 0, ...orientationOnlyApp1(orientation));
  const head = Uint8Array.from(out);
  const rest = b.subarray(i);
  const merged = new Uint8Array(head.length + rest.length);
  merged.set(head, 0);
  merged.set(rest, head.length);
  return merged;
}

/** PNG: drop the text and EXIF chunks (tEXt, zTXt, iTXt, eXIf, tIME).
 *  Chunks are length-prefixed and CRC-suffixed, so a dropped chunk is simply
 *  not copied — the others keep their own CRCs. */
function stripPng(b: Uint8Array): Uint8Array | null {
  const DROP = new Set(['tEXt', 'zTXt', 'iTXt', 'eXIf', 'tIME']);
  const parts: Uint8Array[] = [b.subarray(0, 8)];
  let i = 8;
  let ended = false;
  while (i + 12 <= b.length) {
    const len = ((b[i]! << 24) >>> 0) + (b[i + 1]! << 16) + (b[i + 2]! << 8) + b[i + 3]!;
    const type = String.fromCharCode(b[i + 4]!, b[i + 5]!, b[i + 6]!, b[i + 7]!);
    const end = i + 12 + len;
    if (end > b.length) return null; // a chunk running past the end: truncated
    if (!DROP.has(type)) parts.push(b.subarray(i, end));
    i = end;
    if (type === 'IEND') {
      ended = true;
      break;
    }
  }
  if (!ended) return null; // never reached IEND: not a whole PNG
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

/** WebP: drop the EXIF and XMP chunks, clear their flags in VP8X, and fix
 *  the RIFF size. Chunks are padded to an even length. */
function stripWebp(b: Uint8Array): Uint8Array | null {
  const parts: Uint8Array[] = [];
  let i = 12;
  if (b.length < 20) return null;
  while (i + 8 <= b.length) {
    const type = String.fromCharCode(b[i]!, b[i + 1]!, b[i + 2]!, b[i + 3]!);
    const len = b[i + 4]! + (b[i + 5]! << 8) + (b[i + 6]! << 16) + ((b[i + 7]! << 24) >>> 0);
    const end = i + 8 + len + (len % 2);
    // The last chunk may omit its pad byte; anything longer is truncated.
    if (end > b.length + (len % 2)) return null;
    if (type !== 'EXIF' && type !== 'XMP ') {
      const chunk = Uint8Array.from(b.subarray(i, Math.min(end, b.length)));
      // VP8X flags byte: bit 3 = EXIF, bit 2 = XMP.
      if (type === 'VP8X' && chunk.length > 8) chunk[8] = chunk[8]! & ~0b1100;
      parts.push(chunk);
    }
    i = Math.min(end, b.length);
  }
  if (i !== b.length || !parts.length) return null;
  const body = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(12 + body);
  out.set(b.subarray(0, 12), 0);
  const riff = body + 4; // "WEBP" + chunks
  out[4] = riff & 0xff;
  out[5] = (riff >> 8) & 0xff;
  out[6] = (riff >> 16) & 0xff;
  out[7] = (riff >>> 24) & 0xff;
  let at = 12;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

/** A PDF is whole when its trailer is there: `%%EOF` within the last bytes.
 *  A truncated upload loses exactly that. */
function wholePdf(b: Uint8Array): boolean {
  const tail = String.fromCharCode(...b.subarray(Math.max(0, b.length - 1024)));
  return tail.includes('%%EOF');
}

/** The bytes to store — images without their metadata, PDFs as they came —
 *  or NULL when the file is truncated or corrupt, which is refused rather
 *  than stored for a member to download and find broken. Never throws. */
export function stripMetadata(bytes: Uint8Array, kind: SniffedKind): Uint8Array | null {
  try {
    if (kind === 'jpeg') return stripJpeg(bytes);
    if (kind === 'png') return stripPng(bytes);
    if (kind === 'webp') return stripWebp(bytes);
    return wholePdf(bytes) ? bytes : null;
  } catch {
    return null;
  }
}
