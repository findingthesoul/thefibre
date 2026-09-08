// Auth callback for the visitor portal. Everyone arriving here is a
// PARTICIPANT — someone with a ticket, a booking or a membership — never a
// workspace user, so there is no workspace access gate. Same shim the other
// participant surfaces use.

import { NextResponse } from 'next/server';
import { serverSupabase } from '@/lib/supabase/server';
import { createAuthCallback } from '@thefibre/shared/auth-callback';

export const GET = createAuthCallback({
  getSupabase: serverSupabase,
  redirect: (u) => NextResponse.redirect(u),
  env: process.env,
  publicPrefixes: ['/'],
});
