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
  // 'fibre-platform', because this invoice can belong to ANY app's ledger
  // now — a membership, a thread ticket, a meet booking. It used to say
  // 'membership', which was true while the only reachable endpoint was
  // Membership's. `/api/v1/me/*` is the PLATFORM composing the data
  // subject's own data across apps (portal.ts, the data-wall note), and that
  // is what this header should say. The portal itself is a SURFACE and has
  // no AppId by design (branding.ts SURFACES).
  appId: 'fibre-platform',
  baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL,
  apiPath: (id) => `/api/v1/me/invoices/${id}/pdf`,
  getToken: async () => {
    const supabase = await serverSupabase();
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  },
});
