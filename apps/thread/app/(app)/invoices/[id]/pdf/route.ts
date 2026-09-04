// Streams the invoice PDF from the EU API to the browser, carrying the
// user's session token (a plain <a href> cannot send Authorization).
// HARD RULE §13: nothing is stored on Vercel — this is a pass-through.

import { type NextRequest } from 'next/server';
import { serverSupabase } from '@/lib/supabase/server';

const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const supabase = await serverSupabase();
  const { data } = await supabase.auth.getSession();
  if (!data.session) return new Response('sign in first', { status: 401 });

  const r = await fetch(`${baseUrl}/api/v1/purchases/${encodeURIComponent(id)}/pdf`, {
    headers: {
      Authorization: `Bearer ${data.session.access_token}`,
      'X-App-ID': 'the-thread',
    },
    cache: 'no-store',
  });
  if (!r.ok) return new Response('could not build the PDF', { status: r.status });
  return new Response(r.body, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition':
        r.headers.get('Content-Disposition') ?? 'attachment; filename="invoice.pdf"',
    },
  });
}
