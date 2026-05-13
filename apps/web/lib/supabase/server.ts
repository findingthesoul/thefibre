import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

export async function serverSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet: { name: string; value: string; options: CookieOptions }[]) => {
          // Cookie writes from a Server Component throw. Supabase calls this
          // to refresh tokens; safe to ignore here — token refresh happens
          // in /auth/callback (a Route Handler) and on next sign-in. If you
          // want stale-but-valid sessions to auto-refresh between requests,
          // add a Next.js middleware that calls supabase.auth.getUser().
          try {
            for (const { name, value, options } of toSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Read-only context; silently ignore.
          }
        },
      },
    },
  );
}
