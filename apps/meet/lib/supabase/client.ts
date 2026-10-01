import { createBrowserClient } from '@supabase/ssr';
import { createBrowserSupabase } from '@thefibre/shared/supabase-session';

// The browser Supabase client; the body is in @thefibre/shared/supabase-session
// (see lib/supabase/server.ts). The env names are written out literally
// because Next only inlines NEXT_PUBLIC_* where it can see the name.
export const browserSupabase = createBrowserSupabase({
  createClient: (url, key, options) => createBrowserClient(url, key, options),
  url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  cookieDomain: process.env.NEXT_PUBLIC_COOKIE_DOMAIN,
});
