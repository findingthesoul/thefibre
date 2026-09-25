// POST /api/erasure — the browser's way to file a removal request without
// ever holding a token. Same standing-in-the-middle shape as /api/rsvp and
// /api/calendar: the session lives server-side and this forwards one field.
//
// It decides nothing. What a removal means, what is kept by law and what is
// blocked because other people depend on it, is worked out in the API against
// the verified email — the only place a check cannot be skipped by calling
// something else.

import { serverSupabase } from '@/lib/supabase/server';

const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const supabase = await serverSupabase();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return new Response(JSON.stringify({ error: 'sign in required' }), { status: 401 });

  const body = await req.text();
  const res = await fetch(`${baseUrl}/api/v1/me/portal/erasure`, {
    method: 'POST',
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
