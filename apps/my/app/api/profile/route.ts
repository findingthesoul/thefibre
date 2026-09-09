// PATCH /api/profile — saving your own details without the browser ever
// holding a token. Same shape and same reasoning as /api/rsvp: the page is a
// server component, the session lives there, and a client component talking
// to the Fibre API directly would need the access token in the browser.
//
// It forwards rather than decides. What may be changed, and what a name
// change reaches, is settled in the API against the verified email — the only
// place a check cannot be skipped by calling something else.

import { serverSupabase } from '@/lib/supabase/server';

const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';

export const dynamic = 'force-dynamic';

export async function PATCH(req: Request) {
  const supabase = await serverSupabase();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return new Response(JSON.stringify({ error: 'sign in required' }), { status: 401 });

  const res = await fetch(`${baseUrl}/api/v1/me/profile`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: await req.text(),
    cache: 'no-store',
  });

  return new Response(await res.text(), {
    status: res.status,
    headers: { 'Content-Type': 'application/json' },
  });
}
