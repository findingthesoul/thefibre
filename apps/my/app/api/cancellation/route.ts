// Asking to cancel a place, or withdrawing the request — the signed-in half,
// standing in the middle like /api/rsvp: the session lives server-side and
// the browser never holds a token. The API decides who owns the place.

import { serverSupabase } from '@/lib/supabase/server';

const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';

export const dynamic = 'force-dynamic';

const ID = /^[0-9a-f-]{36}$/i;

async function forward(req: Request, method: 'POST' | 'DELETE') {
  const supabase = await serverSupabase();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return new Response(JSON.stringify({ error: 'sign in required' }), { status: 401 });

  const body = (await req.json().catch(() => null)) as { enrolment_id?: string; reason?: string | null } | null;
  const id = body?.enrolment_id ?? '';
  if (!ID.test(id)) return new Response(JSON.stringify({ error: 'which place?' }), { status: 400 });

  const res = await fetch(`${baseUrl}/api/v1/me/enrolments/${id}/cancellation-request`, {
    method,
    headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
    body: method === 'POST' ? JSON.stringify({ reason: body?.reason ?? null }) : undefined,
    cache: 'no-store',
  });
  return new Response(await res.text(), { status: res.status, headers: { 'Content-Type': 'application/json' } });
}

export const POST = (req: Request) => forward(req, 'POST');
export const DELETE = (req: Request) => forward(req, 'DELETE');
