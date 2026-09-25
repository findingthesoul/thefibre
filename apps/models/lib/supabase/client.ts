import { createBrowserClient } from '@supabase/ssr';

const COOKIE_DOMAIN = process.env.NEXT_PUBLIC_COOKIE_DOMAIN || undefined;

export function browserSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // Spread rather than `: undefined`. Under exactOptionalPropertyTypes,
      // an explicit undefined is not the same as an absent key, and newer
      // @supabase/ssr types say cookieOptions may be absent but never
      // undefined — which broke every app's build on the dependency bump of
      // 2026-09-23. Omitting the key says the same thing and always will.
      ...(COOKIE_DOMAIN ? { cookieOptions: { domain: COOKIE_DOMAIN } } : {}),
    },
  );
}
