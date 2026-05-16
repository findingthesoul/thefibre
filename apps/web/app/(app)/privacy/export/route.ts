// Proxy: GET /privacy/export → API /api/v1/privacy/export, with the user's
// Supabase access token attached. Streams the JSON back as a download so a
// client-side link click yields a file on disk. Vercel never touches the
// payload contents (hard rule §13 — no personal data in Vercel): we forward
// bytes only.

import { NextResponse } from 'next/server';
import { serverSupabase } from '@/lib/supabase/server';

const PLATFORM_APP_ID = 'fibre-platform';

export async function GET() {
  const supabase = await serverSupabase();
  const { data } = await supabase.auth.getSession();
  if (!data.session) {
    return NextResponse.json({ error: 'no session' }, { status: 401 });
  }

  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';
  const res = await fetch(`${apiBase}/api/v1/privacy/export`, {
    headers: {
      Authorization: `Bearer ${data.session.access_token}`,
      'X-App-ID': PLATFORM_APP_ID,
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    const body = await res.text();
    return new NextResponse(body, {
      status: res.status,
      headers: { 'Content-Type': res.headers.get('Content-Type') ?? 'text/plain' },
    });
  }

  const filename =
    res.headers.get('Content-Disposition') ??
    `attachment; filename="fibre-data-export.json"`;

  return new NextResponse(res.body, {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': filename,
      'Cache-Control': 'no-store',
    },
  });
}
