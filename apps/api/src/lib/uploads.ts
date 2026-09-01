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
import { adminClient } from '../db.js';

const MAX_BYTES = 5 * 1024 * 1024;
// Raster only. SVG is a document that can carry script, and this bucket is
// public — an uploaded SVG is stored XSS on our own domain.
const TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif'];

export async function handleUpload(c: Context) {
  const ctx = c.get('ctx');
  const body = await c.req.parseBody();
  const file = body.file;
  if (!(file instanceof File)) return c.json({ error: 'multipart field "file" required' }, 400);
  if (file.size > MAX_BYTES) return c.json({ error: 'max 5MB' }, 400);
  if (!TYPES.includes(file.type)) {
    return c.json({ error: 'images only (png, jpeg, webp, gif, avif)' }, 400);
  }
  const ext = (file.name.split('.').pop() ?? 'png').toLowerCase().replace(/[^a-z0-9]/g, '');
  // Workspace-prefixed so a bucket listing stays legible and a workspace's
  // assets can be found — and deleted — as a set.
  const path = `${ctx.workspaceId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await adminClient.storage
    .from('thread-assets')
    .upload(path, Buffer.from(await file.arrayBuffer()), {
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
