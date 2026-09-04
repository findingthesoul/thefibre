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

export async function handleUpload(c: Context) {
  const ctx = c.get('ctx');
  const body = await c.req.parseBody();
  const file = body.file;
  if (!(file instanceof File)) return c.json({ error: 'multipart field "file" required' }, 400);
  if (file.size > MAX_BYTES) return c.json({ error: 'max 5MB' }, 400);
  if (!TYPES.includes(file.type)) {
    return c.json({ error: 'images only (png, jpeg, webp, gif, avif, svg)' }, 400);
  }

  let bytes: Buffer;
  if (file.type === 'image/svg+xml') {
    const clean = sanitizeSvg(await file.text());
    if (!clean) return c.json({ error: 'that SVG did not survive sanitising — export it as plain shapes and retry' }, 400);
    bytes = Buffer.from(clean, 'utf8');
  } else {
    bytes = Buffer.from(await file.arrayBuffer());
  }

  const ext = (file.name.split('.').pop() ?? 'png').toLowerCase().replace(/[^a-z0-9]/g, '');
  // Workspace-prefixed so a bucket listing stays legible and a workspace's
  // assets can be found — and deleted — as a set.
  const path = `${ctx.workspaceId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await adminClient.storage
    .from('thread-assets')
    .upload(path, bytes, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    });
  if (error) {
    console.error('[uploads] failed', error);
    return c.json({ error: error.message }, 500);
  }
  const { data } = adminClient.storage.from('thread-assets').getPublicUrl(path);
  return c.json({ url: data.publicUrl }, 201);
}
