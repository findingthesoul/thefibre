// Streams the invoice PDF from the EU API — shared factory, see
// @thefibre/shared/invoice-pdf-route (HARD RULE §13: pass-through only).

import { createInvoicePdfRoute } from '@thefibre/shared/invoice-pdf-route';
import { serverSupabase } from '@/lib/supabase/server';

export const GET = createInvoicePdfRoute({
  appId: 'fibre-meet',
  baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL,
  getToken: async () => {
    const supabase = await serverSupabase();
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  },
});
