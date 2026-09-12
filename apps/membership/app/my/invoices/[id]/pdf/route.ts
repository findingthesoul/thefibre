// A member downloading their own invoice. Same pass-through factory the
// admin side uses (HARD RULE §13: nothing stored on Vercel), pointed at the
// portal's email-scoped endpoint instead of the workspace-scoped ledger one
// — a member has no workspace seat and would only ever get a 403 there.

import { createInvoicePdfRoute } from '@thefibre/shared/invoice-pdf-route';
import { serverSupabase } from '@/lib/supabase/server';

export const GET = createInvoicePdfRoute({
  appId: 'membership',
  baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL,
  apiPath: (id) => `/api/v1/membership/portal/me/invoices/${id}/pdf`,
  getToken: async () => {
    const supabase = await serverSupabase();
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  },
});
