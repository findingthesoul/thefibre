import Image from 'next/image';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { serverSupabase } from '@/lib/supabase/server';
import { SignInButton } from '../sign-in-button';
import { APPS } from '@thefibre/shared';

const FIBRE = APPS['fibre-platform'];

export const metadata = {
  title: `Sign in · ${FIBRE.name}`,
};

// A `next` path (e.g. a /connect consent URL the (app) layout bounced here) is
// carried through sign-in and honoured on the far side. Only same-origin
// absolute paths are allowed — never an off-site URL — so this cannot be turned
// into an open redirect.
function safeNext(raw: string | undefined): string | null {
  if (!raw) return null;
  return raw.startsWith('/') && !raw.startsWith('//') ? raw : null;
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const raw = Array.isArray(sp.next) ? sp.next[0] : sp.next;
  const next = safeNext(raw);

  // Already signed in? Go where they were headed (the /connect page renders its
  // own consent), or the dashboard.
  const supabase = await serverSupabase();
  const { data: claims } = await supabase.auth.getClaims();
  if (claims) redirect(next ?? '/dashboard');

  return (
    <main className="min-h-screen bg-white text-neutral-900">
      <div className="mx-auto max-w-md px-6 py-20">
        {/* The mark, not the old block-and-words lockup — see app/page.tsx. */}
        <Image
          src="/brand/apps/fibre.png"
          alt={FIBRE.name}
          width={512}
          height={512}
          priority
          className="h-24 w-24 rounded-2xl"
        />
        <h1 className="mt-3 text-3xl font-medium tracking-tight leading-tight">
          Sign in
        </h1>
        <p className="mt-3 text-sm text-neutral-600 leading-relaxed">
          Continue with Google, or use an email sign-in code if you don&rsquo;t
          have a Google account on the address you&rsquo;ve been invited at.
        </p>

        <div className="mt-8">
          <SignInButton next={next} />
        </div>

        <div className="mt-10 text-xs text-neutral-500">
          New here?{' '}
          <Link
            href="/request-access"
            className="underline underline-offset-4 hover:text-neutral-900"
          >
            Request access
          </Link>
          .
        </div>
      </div>
    </main>
  );
}
