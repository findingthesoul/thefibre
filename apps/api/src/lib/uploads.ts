// Uploading an image, for any app.
//
// This began as POST /thread/uploads and stayed there while The Thread was the
// only place with a photo picker. The Fibre's own profile still asked people
// to paste a URL — which is not a worse design so much as no design; nobody
// has a URL for a photograph that is on their phone.
//
// One handler now, mounted at /api/v1/uploads for everyone and left in place
// at /thread/uploads so nothing already calling it breaks.
//
// The bucket keeps its name. `thread-assets` is where every existing cover,
// certificate background and organiser photo lives; renaming it would mean
// rewriting stored URLs across live threads to make one identifier read
// nicely. It is the shared asset bucket, and this comment is cheaper.

import type { Context } from 'hono';
import DOMPurify from 'isomorphic-dompurify';
import { adminClient } from '../db.js';
import { PHOTO_TYPES, stripMetadata, type PhotoType } from './strip-metadata.js';

const MAX_BYTES = 5 * 1024 * 1024;
// SVG is a document that can carry script, and this bucket is public — a raw
// SVG upload would be stored XSS. Accepted anyway ("Logo upload: no SVG?" —
// Sjoerd, 2026-09-04; logos ARE svgs) because every one passes through
// DOMPurify's SVG profile below: scripts, event handlers and foreignObject
// stripped by an actually-audited sanitizer, never a hand-rolled regex.
const TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif', 'image/svg+xml'];

/** Sanitized SVG source, or null when nothing safe survives. */
function sanitizeSvg(source: string): string | null {
  // DOMPurify's SVG profile drops script/event handlers/javascript: URIs on
  // its own; foreignObject (an HTML escape hatch) is the one extra ban.
  // <style> and internal hrefs stay — Illustrator exports depend on them and
  // neither can execute in an SVG document.
  const clean = DOMPurify.sanitize(source, {
    USE_PROFILES: { svg: true, svgFilters: true },
    FORBID_TAGS: ['foreignObject'],
  });
  return clean.includes('<svg') ? clean : null;
}

export type Stored = { url: string; path: string } | { error: string; status: 400 | 500 };

const BUCKET = 'thread-assets';

/**
 * Store one image in the shared public bucket, under `prefix`. THE pipeline:
 * every picture the platform keeps goes through here — an organiser's photo
 * or logo (prefix = workspace id, POST /api/v1/uploads) and a member's own
 * profile photo (prefix = profiles/<identity_profile.id>, my.thread).
 *
 * JPEG, PNG and WebP lose their metadata first (lib/strip-metadata.ts): a
 * phone photo carries EXIF, EXIF carries GPS, and this bucket is public.
 * GIF and AVIF are stored as they come — accepted for logos and covers, not
 * offered for profile photos (`types` narrows them). SVG is sanitised.
 */
export async function storeImage(file: File, prefix: string, types: readonly string[] = TYPES): Promise<Stored> {
  if (file.size > MAX_BYTES) return { error: 'max 5MB', status: 400 };
  if (!types.includes(file.type)) {
    return {
      error: types === TYPES ? 'images only (png, jpeg, webp, gif, avif, svg)' : 'a photo: png, jpeg or webp',
      status: 400,
    };
  }

  let bytes: Buffer;
  if (file.type === 'image/svg+xml') {
    const clean = sanitizeSvg(await file.text());
    if (!clean) return { error: 'that SVG did not survive sanitising — export it as plain shapes and retry', status: 400 };
    bytes = Buffer.from(clean, 'utf8');
  } else {
    bytes = Buffer.from(await file.arrayBuffer());
    if ((PHOTO_TYPES as readonly string[]).includes(file.type)) {
      try {
        bytes = stripMetadata(file.type as PhotoType, bytes);
      } catch (e) {
        // A file whose structure we cannot walk is refused, never stored
        // with its metadata intact.
        return { error: `${(e as Error).message} — save it again as a JPEG or PNG and retry`, status: 400 };
      }
    }
  }

  const ext = (file.name.split('.').pop() ?? 'png').toLowerCase().replace(/[^a-z0-9]/g, '');
  const path = `${prefix}/${crypto.randomUUID()}.${ext}`;
  const { error } = await adminClient.storage.from(BUCKET).upload(path, bytes, {
    contentType: file.type || 'application/octet-stream',
    upsert: false,
  });
  if (error) {
    console.error('[uploads] failed', error);
    return { error: error.message, status: 500 };
  }
  const { data } = adminClient.storage.from(BUCKET).getPublicUrl(path);
  return { url: data.publicUrl, path };
}

/**
 * Remove a stored image by its public URL — only when it lies under
 * `prefix/`. A URL outside it (an organiser's old workspace upload, a pasted
 * link, another bucket) is left alone: it may still be referenced elsewhere.
 * Failure is logged, not thrown; the profile already points elsewhere.
 */
export async function removeStoredImage(url: string | null | undefined, prefix: string): Promise<boolean> {
  if (!url) return false;
  const marker = `/object/public/${BUCKET}/`;
  const at = url.indexOf(marker);
  if (at < 0) return false;
  const path = decodeURIComponent(url.slice(at + marker.length).split('?')[0] ?? '');
  if (!path.startsWith(`${prefix}/`) || path.includes('..')) return false;
  const { error } = await adminClient.storage.from(BUCKET).remove([path]);
  if (error) {
    console.error('[uploads] remove failed', { path, message: error.message });
    return false;
  }
  return true;
}

export async function handleUpload(c: Context) {
  const ctx = c.get('ctx');
  const body = await c.req.parseBody();
  const file = body.file;
  if (!(file instanceof File)) return c.json({ error: 'multipart field "file" required' }, 400);
  // Workspace-prefixed so a bucket listing stays legible and a workspace's
  // assets can be found — and deleted — as a set.
  const r = await storeImage(file, ctx.workspaceId);
  if ('error' in r) return c.json({ error: r.error }, r.status);
  return c.json({ url: r.url }, 201);
}
