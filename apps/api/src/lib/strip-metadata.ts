// Strip the metadata from a profile photo before it is stored (2026-10-16,
// the coordinator's review of member profile editing): a photo straight off
// a phone carries EXIF, and EXIF carries the GPS position it was taken at.
// A member photo is public in the member directory, so the location of their
// home would be too.
//
// Pure byte surgery, no image library: the API image has no native decoder
// (sharp would mean a native dependency in the Fly build), and nothing here
// needs pixels. The browser re-encodes the photo through a canvas before
// upload, which already drops metadata and applies the orientation; this is
// the server's own guarantee for a file that did not come through that path.
//
// What is KEPT: what decodes the picture, and its colour profile (an ICC
// profile describes colour, not the person). What goes: EXIF, XMP, comments,
// text chunks, timestamps. A format this does not know is refused by the
// caller, never stored as-is.

export type PhotoType = 'image/jpeg' | 'image/png' | 'image/webp';
export const PHOTO_TYPES: readonly PhotoType[] = ['image/jpeg', 'image/png', 'image/webp'];

export function stripMetadata(type: PhotoType, input: Buffer): Buffer {
  if (type === 'image/jpeg') return stripJpeg(input);
  if (type === 'image/png') return stripPng(input);
  return stripWebp(input);
}

function bad(what: string): never {
  throw new Error(`not a valid ${what} file`);
}

// JPEG: SOI, then segments FF xx + 2-byte big-endian length (which includes
// itself), until SOS (FF DA), after which the entropy-coded data runs to EOI
// and is copied whole. Kept: APP0 (JFIF), APP2 (ICC profile; also MPF, which
// carries no personal data), APP14 (Adobe colour transform), and every
// non-APP marker (tables, frame header). Dropped: APP1 (EXIF and XMP),
// APP3–APP13, APP15, COM.
function stripJpeg(b: Buffer): Buffer {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) bad('JPEG');
  const out: Buffer[] = [b.subarray(0, 2)];
  let i = 2;
  while (i < b.length) {
    if (b[i] !== 0xff) bad('JPEG');
    // Fill bytes: any number of FF before a marker.
    while (b[i + 1] === 0xff) i++;
    const marker = b[i + 1];
    if (marker === undefined) bad('JPEG');
    if (marker === 0xda) {
      out.push(b.subarray(i));
      return Buffer.concat(out);
    }
    // Standalone markers carry no length.
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      out.push(b.subarray(i, i + 2));
      i += 2;
      continue;
    }
    if (marker === 0xd9) {
      out.push(b.subarray(i, i + 2));
      return Buffer.concat(out);
    }
    if (i + 4 > b.length) bad('JPEG');
    const len = b.readUInt16BE(i + 2);
    if (len < 2 || i + 2 + len > b.length) bad('JPEG');
    const isApp = marker >= 0xe0 && marker <= 0xef;
    const keepApp = marker === 0xe0 || marker === 0xe2 || marker === 0xee;
    const drop = (isApp && !keepApp) || marker === 0xfe;
    if (!drop) out.push(b.subarray(i, i + 2 + len));
    i += 2 + len;
  }
  bad('JPEG');
}

// PNG: signature, then chunks (4-byte length, 4-byte type, data, 4-byte CRC).
// An allow-list, not a deny-list: a chunk type invented next year is dropped,
// not carried (memory: exemption lists fail open).
const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PNG_KEEP = new Set(['IHDR', 'PLTE', 'IDAT', 'IEND', 'tRNS', 'gAMA', 'cHRM', 'sRGB', 'iCCP', 'sBIT', 'pHYs', 'acTL', 'fcTL', 'fdAT']);
function stripPng(b: Buffer): Buffer {
  if (b.length < 8 || !b.subarray(0, 8).equals(PNG_SIG)) bad('PNG');
  const out: Buffer[] = [PNG_SIG];
  let i = 8;
  let ended = false;
  while (i + 12 <= b.length) {
    const len = b.readUInt32BE(i);
    const type = b.toString('latin1', i + 4, i + 8);
    const end = i + 12 + len;
    if (end > b.length) bad('PNG');
    if (PNG_KEEP.has(type)) out.push(b.subarray(i, end));
    i = end;
    if (type === 'IEND') {
      ended = true;
      break;
    }
  }
  if (!ended) bad('PNG');
  return Buffer.concat(out);
}

// WebP: RIFF <size> WEBP, then chunks (4-byte FourCC, 4-byte little-endian
// size, data, padded to even). Dropped: EXIF, XMP and anything unknown. The
// VP8X header's EXIF and XMP flags are cleared to match, and the RIFF size is
// rewritten.
const WEBP_KEEP = new Set(['VP8 ', 'VP8L', 'VP8X', 'ALPH', 'ANIM', 'ANMF', 'ICCP']);
function stripWebp(b: Buffer): Buffer {
  if (b.length < 12 || b.toString('latin1', 0, 4) !== 'RIFF' || b.toString('latin1', 8, 12) !== 'WEBP') bad('WebP');
  const chunks: Buffer[] = [];
  let i = 12;
  while (i + 8 <= b.length) {
    const fourcc = b.toString('latin1', i, i + 4);
    const size = b.readUInt32LE(i + 4);
    const end = i + 8 + size + (size % 2);
    if (i + 8 + size > b.length) bad('WebP');
    if (WEBP_KEEP.has(fourcc)) {
      const chunk = Buffer.from(b.subarray(i, Math.min(end, b.length)));
      // VP8X flags byte: bit 3 = EXIF, bit 2 = XMP.
      if (fourcc === 'VP8X' && chunk.length > 8) chunk[8] = chunk[8]! & ~0x0c;
      chunks.push(chunk);
    }
    i = end;
  }
  if (!chunks.length) bad('WebP');
  const body = Buffer.concat(chunks);
  const head = Buffer.alloc(12);
  head.write('RIFF', 0, 'latin1');
  head.writeUInt32LE(4 + body.length, 4);
  head.write('WEBP', 8, 'latin1');
  return Buffer.concat([head, body]);
}
