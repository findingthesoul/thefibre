// A member downloading their own invoice from the visitor portal.
//
// The same pass-through factory Membership's /my uses and the admin side
// uses — NOT a third copy. It exists because a plain <a> cannot carry an
// Authorization header, and hard rule §13 means nothing is stored on Vercel:
// this reads the session server-side and streams the API's bytes through.
//
// Pointed at the portal's EMAIL-scoped endpoint, not the workspace-scoped
// ledger one: a visitor has no workspace seat and would only ever get a 403
// there.

import { createInvoicePdfRoute } from '@thefibre/shared/invoice-pdf-route';
import { serverSupabase } from '@/lib/supabase/server';

export const GET = createInvoicePdfRoute({
  // 'membership', not 'my-portal': this identifies whose LEDGER the invoice
  // belongs to, and the portal is a SURFACE, not a catalogue app — it has no
  // AppId by design (branding.ts SURFACES). The invoice is a membership
  // invoice; the portal is only the door it is fetched through.
  appId: 'membership',
  baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL,
  apiPath: (id) => `/api/v1/membership/portal/me/invoices/${id}/pdf`,
  getToken: async () => {
    const supabase = await serverSupabase();
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  },
});
