// POST /api/email-templates/image — an email image, forwarded as it came
// (multipart) to the API, which checks its type from the bytes and its size.
// A route handler (like member-page documents) because a server action's
// body stops at 1 MB.

import { serverSupabase } from '@/lib/supabase/server';

const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const supabase = await serverSupabase();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return new Response(JSON.stringify({ error: 'sign in required' }), { status: 401 });
  const res = await fetch(`${baseUrl}/api/v1/membership/email-templates/image`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.access_token}`, 'X-App-ID': 'membership' },
    body: await request.formData(),
    cache: 'no-store',
  });
  return new Response(await res.text(), { status: res.status, headers: { 'Content-Type': 'application/json' } });
}
