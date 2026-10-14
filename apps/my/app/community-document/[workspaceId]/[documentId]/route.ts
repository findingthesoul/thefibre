// GET /community-document/<workspace>/<document> — open one of a community's
// documents. A plain link cannot carry a bearer token, so this handler holds
// the session server-side, asks the API (which checks membership) for a
// 60-second signed address, and redirects to it. The address it lands on
// stops working within a minute, so a forwarded link is a dead link.

import { NextResponse } from 'next/server';
import { serverSupabase } from '@/lib/supabase/server';

const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string; documentId: string }> },
) {
  const { workspaceId, documentId } = await params;
  const supabase = await serverSupabase();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return NextResponse.redirect(new URL('/', request.url));

  const res = await fetch(
    `${baseUrl}/api/v1/me/portal/community/${encodeURIComponent(workspaceId)}/documents/${encodeURIComponent(documentId)}`,
    { headers: { Authorization: `Bearer ${session.access_token}` }, cache: 'no-store' },
  );
  if (!res.ok) return new NextResponse('This document is not available.', { status: 404 });
  const { url } = (await res.json()) as { url: string };
  return NextResponse.redirect(url);
}
