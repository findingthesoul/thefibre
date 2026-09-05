// Streams an invoice PDF from the EU API to the browser, carrying the
// user's session token (a plain <a href> cannot send Authorization).
// HARD RULE §13: nothing is stored on Vercel — this is a pass-through.
//
// One factory instead of five byte-alike route.ts copies that differed only
// by X-App-ID (component-inventory.md Phase 4 — and membership's copy had
// drifted to sending Meet's app id). The session lookup is app-local
// (each app has its own Supabase server client), so it's injected:
//
//   export const GET = createInvoicePdfRoute({
//     appId: 'fibre-meet',
//     baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL,
//     getToken: async () => {
//       const supabase = await serverSupabase();
//       const { data } = await supabase.auth.getSession();
//       return data.session?.access_token ?? null;
//     },
//   });
//
// baseUrl is injected because shared has no node types (house rule — no
// process.env reads in this package).

import type { AppId } from './index.js';

export function createInvoicePdfRoute({
  appId,
  getToken,
  baseUrl,
}: {
  appId: AppId;
  /** Resolve the signed-in user's access token, or null when signed out. */
  getToken: () => Promise<string | null>;
  /** NEXT_PUBLIC_API_BASE_URL — defaults to local dev. */
  baseUrl?: string | undefined;
}) {
  return async function GET(
    _req: Request,
    ctx: { params: Promise<{ id: string }> },
  ): Promise<Response> {
    const { id } = await ctx.params;
    const token = await getToken();
    if (!token) return new Response('sign in first', { status: 401 });

    const base = baseUrl ?? 'http://localhost:8080';
    const r = await fetch(`${base}/api/v1/purchases/${encodeURIComponent(id)}/pdf`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'X-App-ID': appId,
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
  };
}
