import { describe, expect, it } from 'vitest';
import { sniff, stripMetadata } from './file-sniff.js';

const bytes = (...xs: (number | string)[]) =>
  Uint8Array.from(xs.flatMap((x) => (typeof x === 'string' ? [...x].map((c) => c.charCodeAt(0)) : [x])));
const text = (b: Uint8Array) => String.fromCharCode(...b);
const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));

describe('sniff — the type comes from the bytes', () => {
  it('knows the four kinds', () => {
    expect(sniff(bytes('%PDF-1.7\n'))).toBe('pdf');
    expect(sniff(bytes(0x89, 'PNG', 0x0d, 0x0a, 0x1a, 0x0a))).toBe('png');
    expect(sniff(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe('jpeg');
    expect(sniff(bytes('RIFF', 0, 0, 0, 0, 'WEBP'))).toBe('webp');
  });
  it('refuses anything else, whatever it is called', () => {
    expect(sniff(bytes('<html><script>'))).toBeNull();
    expect(sniff(bytes('PK', 3, 4))).toBeNull(); // a .docx / zip
    expect(sniff(bytes('RIFF', 0, 0, 0, 0, 'WAVE'))).toBeNull();
  });
});

describe('stripMetadata — a phone photo loses its EXIF, keeps its picture', () => {
  it('JPEG: APP1 (Exif) and COM are dropped; APP0, tables and scan data stay', () => {
    const app0 = [0xff, 0xe0, 0x00, 0x06, ...ascii('JFIF')];
    const exifPayload = ascii('Exif\0\0GPS52.37N');
    const app1 = [0xff, 0xe1, 0x00, exifPayload.length + 2, ...exifPayload];
    const com = [0xff, 0xfe, 0x00, 0x07, ...ascii('hello')];
    const dqt = [0xff, 0xdb, 0x00, 0x04, 0x01, 0x02];
    const scan = [0xff, 0xda, 0x00, 0x04, 0x09, 0x09, 0xaa, 0xbb, 0xff, 0xd9];
    const out = stripMetadata(Uint8Array.from([0xff, 0xd8, ...app0, ...app1, ...com, ...dqt, ...scan]), 'jpeg');
    expect(text(out)).not.toContain('GPS');
    expect(text(out)).not.toContain('hello');
    expect(text(out)).toContain('JFIF');
    expect([...out.slice(-10)]).toEqual(scan);
    expect(sniff(out)).toBe('jpeg');
  });

  it('PNG: tEXt and eXIf chunks are dropped; IHDR, IDAT and IEND stay', () => {
    const chunk = (type: string, data: number[]) => [0, 0, 0, data.length, ...ascii(type), ...data, 1, 2, 3, 4];
    const png = Uint8Array.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      ...chunk('IHDR', [0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0]),
      ...chunk('tEXt', ascii('Location\0Kitchen')),
      ...chunk('eXIf', ascii('GPS')),
      ...chunk('IDAT', [9, 9, 9]),
      ...chunk('IEND', []),
    ]);
    const out = stripMetadata(png, 'png');
    expect(text(out)).not.toContain('Kitchen');
    expect(text(out)).not.toContain('GPS');
    for (const keep of ['IHDR', 'IDAT', 'IEND']) expect(text(out)).toContain(keep);
    expect(sniff(out)).toBe('png');
  });

  it('WebP: EXIF and XMP chunks are dropped, their VP8X flags cleared, the RIFF size fixed', () => {
    const chunk = (type: string, data: number[]) => [
      ...ascii(type),
      data.length, 0, 0, 0,
      ...data,
      ...(data.length % 2 ? [0] : []),
    ];
    const vp8x = chunk('VP8X', [0b1100, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    const body = [...ascii('WEBP'), ...vp8x, ...chunk('VP8 ', [7, 7]), ...chunk('EXIF', ascii('GPS')), ...chunk('XMP ', [1, 2])];
    const webp = Uint8Array.from([...ascii('RIFF'), body.length, 0, 0, 0, ...body]);
    const out = stripMetadata(webp, 'webp');
    expect(text(out)).not.toContain('GPS');
    expect(text(out)).not.toContain('XMP');
    expect(out[20]! & 0b1100).toBe(0); // the VP8X flags byte
    const riff = out[4]! + (out[5]! << 8) + (out[6]! << 16) + (out[7]! << 24);
    expect(riff).toBe(out.length - 8);
    expect(sniff(out)).toBe('webp');
  });

  it('a PDF is stored as it came', () => {
    const pdf = bytes('%PDF-1.4 /Author (x)\n%%EOF\n');
    expect(stripMetadata(pdf, 'pdf')).toBe(pdf);
  });

  // ORIENTATION IS KEPT, everything else in EXIF is not: without it every
  // portrait phone photo shows on its side, and it says nothing about where
  // or when the photo was taken.
  it('JPEG: the orientation survives in a minimal EXIF; the GPS beside it does not', () => {
    // EXIF payload: "Exif\0\0" + little-endian TIFF, IFD0 with Orientation=6
    // and a GPS pointer tag, followed by a GPS-ish string.
    const tiff = [
      0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00,
      0x02, 0x00,
      0x12, 0x01, 0x03, 0x00, 0x01, 0x00, 0x00, 0x00, 0x06, 0x00, 0x00, 0x00,
      0x25, 0x88, 0x04, 0x00, 0x01, 0x00, 0x00, 0x00, 0x26, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00,
      ...ascii('GPS52.37N4.89E'),
    ];
    const payload = [...ascii('Exif\0\0'), ...tiff];
    const app1 = [0xff, 0xe1, 0x00, payload.length + 2, ...payload];
    const scan = [0xff, 0xda, 0x00, 0x04, 0x09, 0x09, 0xaa, 0xbb, 0xff, 0xd9];
    const out = stripMetadata(Uint8Array.from([0xff, 0xd8, ...app1, ...scan]), 'jpeg')!;
    expect(text(out)).not.toContain('GPS');
    // The new APP1 right after SOI carries Orientation (0x0112) = 6.
    expect([...out.subarray(0, 4)]).toEqual([0xff, 0xd8, 0xff, 0xe1]);
    const at = [...out].findIndex((v, k) => v === 0x12 && out[k + 1] === 0x01);
    expect(out[at + 8]).toBe(6);
  });
});

// A TRUNCATED OR CORRUPT FILE IS REFUSED — null, never a throw, never stored
// for a member to download and find broken.
describe('stripMetadata — damaged files are refused, not crashed on', () => {
  it('a JPEG cut off before its end-of-image', () => {
    expect(stripMetadata(Uint8Array.from([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x04, 0x01, 0x02, 0xff, 0xda, 0x00, 0x04, 0x09]), 'jpeg')).toBeNull();
  });
  it('a JPEG whose segment runs past the end', () => {
    expect(stripMetadata(Uint8Array.from([0xff, 0xd8, 0xff, 0xe1, 0x40, 0x00, 0x01]), 'jpeg')).toBeNull();
  });
  it('a PNG that never reaches IEND', () => {
    const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, ...ascii('IHDR'), 0, 0, 0, 1]);
    expect(stripMetadata(png, 'png')).toBeNull();
  });
  it('a WebP whose chunk claims more bytes than there are', () => {
    const webp = Uint8Array.from([...ascii('RIFF'), 40, 0, 0, 0, ...ascii('WEBP'), ...ascii('VP8 '), 200, 0, 0, 0, 1, 2, 3]);
    expect(stripMetadata(webp, 'webp')).toBeNull();
  });
  it('a PDF without its trailer', () => {
    expect(stripMetadata(bytes('%PDF-1.7\n1 0 obj << >> endobj\n'), 'pdf')).toBeNull();
  });
});
