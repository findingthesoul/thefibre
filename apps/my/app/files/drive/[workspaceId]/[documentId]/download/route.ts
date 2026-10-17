// GET /files/drive/<workspace>/<entry>/download?file=<id> — download one file
// from a connected Drive folder. A plain link cannot carry the session, so
// this route holds it server-side, asks the API for a one-minute download
// address (POST …/drive/:docId/download), and redirects the browser to it.
// The file then streams from the API, never through here and never from a
// Drive URL. A refusal comes back to the folder with a sentence, not a bare
// error page.
//
// `?inline=1` (the viewer, 2026-10-17): the same, asking the API for an
// INLINE address, which it grants only for a PDF or a png/jpeg/webp/gif. The
// viewer's <iframe>/<img> and its "Open" button point here, so every load,
// refresh and new tab mints its own 60-second token. A failure answers with
// a bare status (the frame shows nothing, the page around it still offers
// Download), never a redirect to the folder page inside the frame. An
// address granted as attachment is not followed, so a file the API won't
// show inline never downloads by itself from inside the viewer.

import { NextResponse } from 'next/server';
import { serverSupabase } from '@/lib/supabase/server';
import { safeDriveDownloadUrl } from '@/lib/drive-redirect';

const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string; documentId: string }> },
) {
  const { workspaceId, documentId } = await params;
  const sp = new URL(request.url).searchParams;
  const file = sp.get('file') ?? '';
  const inline = sp.get('inline') === '1';
  const back = new URL(`/files/drive/${encodeURIComponent(workspaceId)}/${encodeURIComponent(documentId)}`, request.url);
  // Back to the same subfolder the download was started from.
  const folder = sp.get('folder');
  if (folder) back.searchParams.set('folder', folder);
  const supabase = await serverSupabase();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return inline ? new NextResponse(null, { status: 401 }) : NextResponse.redirect(new URL('/', request.url));
  if (!file) return inline ? new NextResponse(null, { status: 404 }) : NextResponse.redirect(back);

  try {
    const res = await fetch(
      `${baseUrl}/api/v1/me/portal/community/${encodeURIComponent(workspaceId)}/drive/${encodeURIComponent(documentId)}/download`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(inline ? { file_id: file, disposition: 'inline' } : { file_id: file }),
        cache: 'no-store',
      },
    );
    const body = (await res.json().catch(() => null)) as { url?: string; code?: string; disposition?: string } | null;
    // Only ever to the API's own download stream (lib/drive-redirect.ts).
    const target = res.ok ? safeDriveDownloadUrl(body?.url, baseUrl) : null;
    if (inline) {
      if (target && body?.disposition === 'inline') return NextResponse.redirect(target);
      if (target) return new NextResponse(null, { status: 415 });
      return new NextResponse(null, { status: res.ok ? 502 : res.status === 404 ? 404 : 502 });
    }
    if (target) return NextResponse.redirect(target);
    if (res.ok) console.error('[my] drive download: refused a redirect target outside the API download stream');
    // An exported Doc/Sheet/Slides that is too large hit Google's export cap,
    // not the download cap: a different sentence, a different number.
    const code = body?.code ?? '';
    back.searchParams.set(
      'error',
      code === 'too_large'
        ? sp.get('export')
          ? 'too_large_export'
          : 'too_large'
        : ['not_found', 'not_shared', 'not_exportable', 'unavailable', 'drive_not_configured'].includes(code)
          ? code
          : 'failed',
    );
  } catch {
    if (inline) return new NextResponse(null, { status: 502 });
    back.searchParams.set('error', 'failed');
  }
  return NextResponse.redirect(back);
}
