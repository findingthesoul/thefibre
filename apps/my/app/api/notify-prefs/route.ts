// The member's own email switch per community, saved. Same standing-in-the-
// middle pattern as /api/directory: the session lives server-side and the
// browser never holds a token.

import { serverSupabase } from '@/lib/supabase/server';

const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';

export const dynamic = 'force-dynamic';

export async function PUT(request: Request) {
  const supabase = await serverSupabase();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return new Response(JSON.stringify({ error: 'sign in required' }), { status: 401 });

  const res = await fetch(`${baseUrl}/api/v1/me/portal/notification-prefs`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
    body: await request.text(),
    cache: 'no-store',
  });
  return new Response(await res.text(), { status: res.status, headers: { 'Content-Type': 'application/json' } });
}
