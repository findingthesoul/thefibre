// Pulse auth callback — destination after sign-in is Pulse's dashboard.
// Shim: the flow lives in @thefibre/shared/auth-callback (extraction phase
// 4 — the six copies had drifted; this is the superset: verifyOtp arrival
// path, magic-link provider mapping, optional public-prefix bypass).

import { NextResponse } from 'next/server';
import { serverSupabase } from '@/lib/supabase/server';
import { createAuthCallback } from '@thefibre/shared/auth-callback';

export const GET = createAuthCallback({
  getSupabase: serverSupabase,
  redirect: (u) => NextResponse.redirect(u),
  env: process.env,
});
