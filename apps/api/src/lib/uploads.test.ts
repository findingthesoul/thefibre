// THE upload pipeline (lib/uploads.ts storeImage), shared by an organiser's
// photo/logo upload (prefix = workspace) and a member's own profile photo
// (prefix = profiles/<id>). Storage is faked; what is checked is what gets
// handed to it: the path, the bytes, the content type, and the URL returned.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const uploaded: { path: string; bytes: Buffer; contentType: string }[] = [];
const removed: string[][] = [];

vi.mock('../db.js', () => ({
  adminClient: {
    storage: {
      from: () => ({
        upload: async (path: string, bytes: Buffer, opts: { contentType: string }) => {
          uploaded.push({ path, bytes, contentType: opts.contentType });
          return { error: null };
        },
        getPublicUrl: (path: string) => ({ data: { publicUrl: `https://x.supabase.co/storage/v1/object/public/thread-assets/${path}` } }),
        remove: async (paths: string[]) => {
          removed.push(paths);
          return { error: null };
        },
      }),
    },
  },
}));

const { storeImage, removeStoredImage } = await import('./uploads.js');
const { PHOTO_TYPES } = await import('./strip-metadata.js');

beforeEach(() => {
  uploaded.length = 0;
  removed.length = 0;
});

const seg = (marker: number, payload: Buffer) => {
  const len = Buffer.alloc(2);
  len.writeUInt16BE(payload.length + 2);
  return Buffer.concat([Buffer.from([0xff, marker]), len, payload]);
};
const scan = Buffer.concat([seg(0xda, Buffer.from([1, 1, 0, 0, 0x3f, 0])), Buffer.from([1, 2, 3]), Buffer.from([0xff, 0xd9])]);
const cleanJpeg = Buffer.concat([Buffer.from([0xff, 0xd8]), seg(0xe0, Buffer.from('JFIF\0')), seg(0xdb, Buffer.alloc(65, 1)), scan]);
const gpsJpeg = Buffer.concat([Buffer.from([0xff, 0xd8]), seg(0xe1, Buffer.from('Exif\0\0GPSLatitude 52.37', 'latin1')), seg(0xe0, Buffer.from('JFIF\0')), seg(0xdb, Buffer.alloc(65, 1)), scan]);

describe('storeImage', () => {
  it('an ORGANISER upload still round-trips: workspace path, same bytes, same type, its public URL', async () => {
    const png = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.from([0, 0, 0, 13]), Buffer.from('IHDR'), Buffer.alloc(13, 2), Buffer.alloc(4),
      Buffer.from([0, 0, 0, 0]), Buffer.from('IEND'), Buffer.alloc(4),
    ]);
    const r = await storeImage(new File([png], 'logo.png', { type: 'image/png' }), 'ws-123');
    expect('url' in r && r.url).toMatch(/\/thread-assets\/ws-123\/[0-9a-f-]+\.png$/);
    expect(uploaded).toHaveLength(1);
    expect(uploaded[0]!.contentType).toBe('image/png');
    expect(uploaded[0]!.bytes.equals(png)).toBe(true);
  });

  it('a JPEG with GPS EXIF is stored WITHOUT it', async () => {
    const r = await storeImage(new File([gpsJpeg], 'me.jpg', { type: 'image/jpeg' }), 'profiles/abc', PHOTO_TYPES);
    expect('url' in r).toBe(true);
    expect(uploaded[0]!.bytes.toString('latin1')).not.toContain('GPSLatitude');
    expect(uploaded[0]!.bytes.equals(cleanJpeg)).toBe(true);
    expect(uploaded[0]!.path).toMatch(/^profiles\/abc\/[0-9a-f-]+\.jpg$/);
  });

  it('the profile photo door refuses a GIF, an AVIF and an SVG; the organiser door still takes them', async () => {
    for (const type of ['image/gif', 'image/avif', 'image/svg+xml']) {
      const r = await storeImage(new File([Buffer.from('x')], 'a', { type }), 'profiles/abc', PHOTO_TYPES);
      expect(r).toEqual({ error: 'a photo: png, jpeg or webp', status: 400 });
    }
    const gif = await storeImage(new File([Buffer.from('GIF89a')], 'a.gif', { type: 'image/gif' }), 'ws-123');
    expect('url' in gif).toBe(true);
  });

  it('a JPEG whose structure cannot be walked is refused, never stored with its metadata', async () => {
    const r = await storeImage(new File([Buffer.from('not a jpeg')], 'x.jpg', { type: 'image/jpeg' }), 'ws-123');
    expect(r).toMatchObject({ status: 400 });
    expect(uploaded).toHaveLength(0);
  });

  it('refuses over 5MB', async () => {
    const r = await storeImage(new File([Buffer.alloc(5 * 1024 * 1024 + 1)], 'big.png', { type: 'image/png' }), 'ws-123');
    expect(r).toEqual({ error: 'max 5MB', status: 400 });
  });
});

describe('removeStoredImage', () => {
  const url = (p: string) => `https://x.supabase.co/storage/v1/object/public/thread-assets/${p}`;
  it('removes an object under the prefix', async () => {
    expect(await removeStoredImage(url('profiles/abc/1.jpg'), 'profiles/abc')).toBe(true);
    expect(removed).toEqual([['profiles/abc/1.jpg']]);
  });
  it('leaves anything outside it: another profile, a workspace upload, a pasted link, a traversal', async () => {
    for (const u of [url('profiles/abd/1.jpg'), url('ws-123/1.jpg'), 'https://example.com/me.jpg', url('profiles/abc/../ws-123/1.jpg')]) {
      expect(await removeStoredImage(u, 'profiles/abc')).toBe(false);
    }
    expect(removed).toHaveLength(0);
  });
});
