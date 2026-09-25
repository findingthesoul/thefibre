import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

// Cookie domain — set in production (NEXT_PUBLIC_COOKIE_DOMAIN=.thefibre.app)
// so that signing into thefibre.app also signs you into meet.thefibre.app and
// thread.thefibre.app. In dev (localhost) the var is unset and cookies fall
// back to the current host.
const COOKIE_DOMAIN = process.env.NEXT_PUBLIC_COOKIE_DOMAIN || undefined;

export async function serverSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // Spread rather than `: undefined`. Under exactOptionalPropertyTypes,
      // an explicit undefined is not the same as an absent key, and newer
      // @supabase/ssr types say cookieOptions may be absent but never
      // undefined — which broke every app's build on the dependency bump of
      // 2026-09-23. Omitting the key says the same thing and always will.
      ...(COOKIE_DOMAIN ? { cookieOptions: { domain: COOKIE_DOMAIN } } : {}),
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (
          toSet: { name: string; value: string; options: CookieOptions }[],
        ) => {
          try {
            for (const { name, value, options } of toSet) {
              cookieStore.set(name, value, {
                ...options,
                ...(COOKIE_DOMAIN ? { domain: COOKIE_DOMAIN } : {}),
              });
            }
          } catch {
            // Read-only Server Component context; silently ignore. Token
            // refresh happens in /auth/callback (Route Handler).
          }
        },
      },
    },
  );
}
