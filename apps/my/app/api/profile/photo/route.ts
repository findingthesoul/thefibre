// POST /api/profile/photo — your profile photo, forwarded to the API with the
// session token held here, never in the browser (same reasoning as
// /api/profile). The API decides everything: type, size, the metadata strip,
// where it is stored, and deleting the photo it replaces.

import { serverSupabase } from '@/lib/supabase/server';

const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const supabase = await serverSupabase();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return new Response(JSON.stringify({ error: 'sign in required' }), { status: 401 });

  const res = await fetch(`${baseUrl}/api/v1/me/profile/photo`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      // The multipart boundary travels in this header; the body is passed on
      // byte for byte.
      'Content-Type': req.headers.get('content-type') ?? 'application/octet-stream',
    },
    body: await req.arrayBuffer(),
    cache: 'no-store',
  });

  return new Response(await res.text(), {
    status: res.status,
    headers: { 'Content-Type': 'application/json' },
  });
}
