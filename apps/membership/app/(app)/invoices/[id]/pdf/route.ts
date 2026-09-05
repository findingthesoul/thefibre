// Streams the invoice PDF from the EU API — shared factory, see
// @thefibre/shared/invoice-pdf-route (HARD RULE §13: pass-through only).
// Was a byte-copy of Meet's route sending X-App-ID: fibre-meet — Membership
// invoices mislabeled as Meet's (caught in the 2026-09-06 phase-4 sweep).

import { createInvoicePdfRoute } from '@thefibre/shared/invoice-pdf-route';
import { serverSupabase } from '@/lib/supabase/server';

export const GET = createInvoicePdfRoute({
  appId: 'membership',
  baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL,
  getToken: async () => {
    const supabase = await serverSupabase();
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  },
});
