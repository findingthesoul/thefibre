// Cross-apex SSO hop — hands the signed-in session to an app on the other
// apex via a single-use 60s code. Shim: the flow lives in
// @thefibre/shared/sso-hop (see that file for the full mechanism).

import { NextResponse } from 'next/server';
import { serverSupabase } from '@/lib/supabase/server';
import { createSsoHop } from '@thefibre/shared/sso-hop';

export const GET = createSsoHop({
  getSupabase: serverSupabase,
  redirect: (u) => NextResponse.redirect(u),
  env: process.env,
  currentApp: 'fibre-pulse',
});
