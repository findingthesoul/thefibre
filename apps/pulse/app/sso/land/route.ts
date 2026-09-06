// Cross-apex SSO landing — redeems a hop code into a fresh session on THIS
// apex, then continues through /auth/callback. Shim: the flow lives in
// @thefibre/shared/sso-hop.

import { NextResponse } from 'next/server';
import { serverSupabase } from '@/lib/supabase/server';
import { createSsoLand } from '@thefibre/shared/sso-hop';

export const GET = createSsoLand({
  getSupabase: serverSupabase,
  redirect: (u) => NextResponse.redirect(u),
  env: process.env,
  currentApp: 'fibre-pulse',
});
