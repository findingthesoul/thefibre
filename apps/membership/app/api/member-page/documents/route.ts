// POST /api/member-page/documents — a document for the community page,
// forwarded as it came (multipart) to the API, which reads its type from the
// bytes and strips image metadata. A route handler rather than a server
// action because a server action's body stops at 1 MB and a document may be
// 10.

import { serverSupabase } from '@/lib/supabase/server';

const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const supabase = await serverSupabase();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return new Response(JSON.stringify({ error: 'sign in required' }), { status: 401 });

  const res = await fetch(`${baseUrl}/api/v1/membership/member-page/documents`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.access_token}`, 'X-App-ID': 'membership' },
    body: await request.formData(),
    cache: 'no-store',
  });
  return new Response(await res.text(), { status: res.status, headers: { 'Content-Type': 'application/json' } });
}
