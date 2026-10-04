// The member's own directory choice, saved. Same standing-in-the-middle
// pattern as /api/calendar: the session lives server-side and the browser
// never holds a token.
//
// GET is not here on purpose — the choices are read while the YOU page
// renders, server-side, so there is nothing for the client to poll.

import { serverSupabase } from '@/lib/supabase/server';

const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';

export const dynamic = 'force-dynamic';

export async function PATCH(request: Request) {
  const supabase = await serverSupabase();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return new Response(JSON.stringify({ error: 'sign in required' }), { status: 401 });

  const res = await fetch(`${baseUrl}/api/v1/membership/portal/me/directory`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: await request.text(),
    cache: 'no-store',
  });

  return new Response(await res.text(), {
    status: res.status,
    headers: { 'Content-Type': 'application/json' },
  });
}
