// The photo metadata strip (lib/strip-metadata.ts). A member photo is public
// in the member directory, so the GPS position EXIF carries must never reach
// storage. Synthetic files, built byte by byte, so each test names exactly
// which segment or chunk it plants and proves it gone — and that the parts
// that decode the picture are still there, unchanged and in order.

import { describe, expect, it } from 'vitest';
import { stripMetadata } from './strip-metadata.js';

const seg = (marker: number, payload: Buffer) => {
  const len = Buffer.alloc(2);
  len.writeUInt16BE(payload.length + 2);
  return Buffer.concat([Buffer.from([0xff, marker]), len, payload]);
};
const GPS = Buffer.from('Exif\0\0MM\0*GPSLatitude 52.3702 GPSLongitude 4.8952', 'latin1');

function jpeg() {
  const app0 = seg(0xe0, Buffer.from('JFIF\0\x01\x01\0\0\x01\0\x01\0\0', 'latin1'));
  const app1 = seg(0xe1, GPS);
  const xmp = seg(0xe1, Buffer.from('http://ns.adobe.com/xap/1.0/\0<x:xmpmeta>Location</x:xmpmeta>', 'latin1'));
  const icc = seg(0xe2, Buffer.from('ICC_PROFILE\0\x01\x01colour', 'latin1'));
  const com = seg(0xfe, Buffer.from('taken at home', 'latin1'));
  const dqt = seg(0xdb, Buffer.alloc(65, 1));
  const sof = seg(0xc0, Buffer.from([8, 0, 1, 0, 1, 1, 1, 0x11, 0]));
  const scan = Buffer.concat([seg(0xda, Buffer.from([1, 1, 0, 0, 0x3f, 0])), Buffer.from([0x12, 0x34, 0xff, 0x00, 0x56]), Buffer.from([0xff, 0xd9])]);
  return { file: Buffer.concat([Buffer.from([0xff, 0xd8]), app0, app1, xmp, icc, com, dqt, sof, scan]), app0, icc, dqt, sof, scan };
}

describe('stripMetadata — JPEG', () => {
  it('removes GPS EXIF, XMP and comments, and keeps JFIF, ICC, tables, frame and scan in order', () => {
    const j = jpeg();
    const out = stripMetadata('image/jpeg', j.file);
    const text = out.toString('latin1');
    expect(text).not.toContain('GPSLatitude');
    expect(text).not.toContain('xmpmeta');
    expect(text).not.toContain('taken at home');
    expect(out.equals(Buffer.concat([Buffer.from([0xff, 0xd8]), j.app0, j.icc, j.dqt, j.sof, j.scan]))).toBe(true);
  });
  it('leaves a JPEG with no metadata byte-identical', () => {
    const j = jpeg();
    const clean = Buffer.concat([Buffer.from([0xff, 0xd8]), j.app0, j.dqt, j.sof, j.scan]);
    expect(stripMetadata('image/jpeg', clean).equals(clean)).toBe(true);
  });
  it('refuses a file that is not a JPEG rather than passing it through', () => {
    expect(() => stripMetadata('image/jpeg', Buffer.from('GIF89a…'))).toThrow(/not a valid JPEG/);
  });
  it('refuses a truncated segment', () => {
    const j = jpeg();
    expect(() => stripMetadata('image/jpeg', j.file.subarray(0, 30))).toThrow(/not a valid JPEG/);
  });
});

const chunk = (type: string, data: Buffer) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  return Buffer.concat([len, Buffer.from(type, 'latin1'), data, Buffer.alloc(4)]);
};
const SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe('stripMetadata — PNG', () => {
  it('drops eXIf and text chunks, keeps the image chunks', () => {
    const ihdr = chunk('IHDR', Buffer.alloc(13, 1));
    const idat = chunk('IDAT', Buffer.from('pixels'));
    const iend = chunk('IEND', Buffer.alloc(0));
    const file = Buffer.concat([SIG, ihdr, chunk('eXIf', GPS), chunk('tEXt', Buffer.from('Location\0home')), chunk('iTXt', Buffer.from('x')), idat, iend]);
    const out = stripMetadata('image/png', file);
    expect(out.toString('latin1')).not.toContain('GPSLatitude');
    expect(out.toString('latin1')).not.toContain('Location');
    expect(out.equals(Buffer.concat([SIG, ihdr, idat, iend]))).toBe(true);
  });
  it('refuses a PNG with no IEND', () => {
    expect(() => stripMetadata('image/png', Buffer.concat([SIG, chunk('IHDR', Buffer.alloc(13))]))).toThrow(/not a valid PNG/);
  });
});

const riff = (fourcc: string, data: Buffer) => {
  const h = Buffer.alloc(8);
  h.write(fourcc, 0, 'latin1');
  h.writeUInt32LE(data.length, 4);
  return Buffer.concat([h, data, data.length % 2 ? Buffer.alloc(1) : Buffer.alloc(0)]);
};

describe('stripMetadata — WebP', () => {
  it('drops EXIF and XMP chunks, clears their VP8X flags, rewrites the RIFF size', () => {
    const vp8xData = Buffer.alloc(10);
    vp8xData[0] = 0x0c | 0x10; // EXIF + XMP + alpha
    const vp8x = riff('VP8X', vp8xData);
    const vp8 = riff('VP8 ', Buffer.from('frame-bytes'));
    const body = Buffer.concat([vp8x, vp8, riff('EXIF', GPS), riff('XMP ', Buffer.from('<x:xmpmeta/>'))]);
    const head = Buffer.alloc(12);
    head.write('RIFF', 0, 'latin1');
    head.writeUInt32LE(4 + body.length, 4);
    head.write('WEBP', 8, 'latin1');
    const out = stripMetadata('image/webp', Buffer.concat([head, body]));
    expect(out.toString('latin1')).not.toContain('GPSLatitude');
    expect(out.toString('latin1')).not.toContain('xmpmeta');
    expect(out.readUInt32LE(4)).toBe(out.length - 8);
    expect(out[20]).toBe(0x10); // only the alpha flag survives
    expect(out.subarray(30).equals(vp8)).toBe(true);
  });
});
