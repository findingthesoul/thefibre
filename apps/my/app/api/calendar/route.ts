// The signed-in half of the calendar subscription: create an address, or
// retire one. Same standing-in-the-middle pattern as /api/rsvp — the session
// lives server-side and the browser never holds a token.
//
// GET is not here on purpose. The status is read while the YOU page renders,
// server-side, so there is nothing for the client to poll.

import { serverSupabase } from '@/lib/supabase/server';

const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';

export const dynamic = 'force-dynamic';

async function forward(method: 'POST' | 'DELETE') {
  const supabase = await serverSupabase();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return new Response(JSON.stringify({ error: 'sign in required' }), { status: 401 });

  const res = await fetch(`${baseUrl}/api/v1/me/portal/calendar`, {
    method,
    headers: { Authorization: `Bearer ${session.access_token}` },
    cache: 'no-store',
  });

  return new Response(await res.text(), {
    status: res.status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const POST = () => forward('POST');
export const DELETE = () => forward('DELETE');
