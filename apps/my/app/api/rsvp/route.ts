// PUT /api/rsvp — the browser's way to answer, without ever holding a token.
//
// The page is a server component and the session lives there. A client
// component that called the Fibre API directly would need the access token in
// the browser, so this handler stands in the middle: it reads the session
// server-side and forwards the one field the API needs. Same reasoning as
// /ics/[threadId]/[itemId].
//
// It forwards rather than decides. Every check that matters — is this item
// real, is this person enrolled, is this thread even asking — happens in the
// API against the verified email, because that is the only place a check
// cannot be skipped by calling something else.

import { serverSupabase } from '@/lib/supabase/server';

const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';

export const dynamic = 'force-dynamic';

export async function PUT(req: Request) {
  const supabase = await serverSupabase();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return new Response(JSON.stringify({ error: 'sign in required' }), { status: 401 });

  const body = await req.text();
  const res = await fetch(`${baseUrl}/api/v1/me/portal/rsvp`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body,
    cache: 'no-store',
  });

  return new Response(await res.text(), {
    status: res.status,
    headers: { 'Content-Type': 'application/json' },
  });
}
