import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createServerSupabase } from '@thefibre/shared/supabase-session';

// The server-side Supabase client. The body — how the session cookie is read,
// written and scoped — is in @thefibre/shared/supabase-session, one copy for
// every app. This file only hands it Next's and Supabase's primitives, and
// writes the three env names out literally so Next can inline them.
export const serverSupabase = createServerSupabase({
  createClient: (url, key, options) => createServerClient(url, key, options),
  cookies,
  url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  // Set in production and on staging (the app's apex) so that signing in to
  // one app signs you in to its siblings; unset on localhost.
  cookieDomain: process.env.NEXT_PUBLIC_COOKIE_DOMAIN,
});
