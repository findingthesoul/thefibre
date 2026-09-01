'use client';

// Client-side image upload — multipart straight to the Fibre API. Server
// actions serialize FormData poorly for binaries, so this goes direct.
//
// The platform endpoint, not The Thread's: /api/v1/uploads takes a picture
// from any app (lib/uploads.ts on the API side).

import { browserSupabase } from './supabase/client';

const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';

export async function uploadAsset(file: File): Promise<string> {
  const { data } = await browserSupabase().auth.getSession();
  if (!data.session) throw new Error('not signed in');
  const fd = new FormData();
  fd.set('file', file);
  const res = await fetch(`${baseUrl}/api/v1/uploads`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${data.session.access_token}`,
      'X-App-ID': 'fibre-platform',
    },
    body: fd,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`upload failed (${res.status}): ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as { url: string };
  return json.url;
}
