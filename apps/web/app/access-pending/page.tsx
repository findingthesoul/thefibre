import Link from 'next/link';
import { serverSupabase } from '@/lib/supabase/server';
import { SignOutBlock } from './sign-out';

export default async function AccessPendingPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const supabase = await serverSupabase();
  const { data } = await supabase.auth.getUser();
  const email = data.user?.email ?? null;

  const heading =
    status === 'denied'
      ? 'Access not approved'
      : status === 'unknown'
      ? 'No request on file'
      : 'Waiting for approval';

  const body =
    status === 'denied'
      ? 'Your access request was reviewed and not approved at this time. If you believe this was a mistake, please contact us.'
      : status === 'unknown'
      ? "We don't have an access request for this email yet. Apply below, or sign in with a different account."
      : "Thanks for signing in. Your access request is in review — we'll email you the moment your workspace is ready.";

  return (
    <main className="min-h-screen bg-white text-neutral-900">
      <div className="mx-auto max-w-xl px-6 py-20">
        <Link href="/" className="text-sm text-neutral-500 hover:text-neutral-900">
          ← The Fibre
        </Link>

        <h1 className="mt-8 text-3xl font-medium tracking-tight">{heading}</h1>
        <p className="mt-4 text-neutral-600 leading-relaxed">{body}</p>

        {email && (
          <p className="mt-6 text-sm text-neutral-500">
            Signed in as <span className="text-neutral-800">{email}</span>.
          </p>
        )}

        <div className="mt-10 flex items-center gap-5">
          {status === 'unknown' && (
            <Link
              href="/request-access"
              className="rounded-md bg-neutral-900 text-white px-5 py-2.5 text-sm font-medium hover:bg-neutral-800"
            >
              Request access
            </Link>
          )}
          <SignOutBlock />
        </div>
      </div>
    </main>
  );
}
