import Link from 'next/link';
import { redirect } from 'next/navigation';
import { serverSupabase } from '@/lib/supabase/server';
import { publicFetch } from '@/lib/public-api';

// The wall the (app) gate sends people to. It used to be the whole answer,
// which was wrong for the largest group hitting it: community members. They
// pay, land on this app, and have no workspace seat by design — their place
// is /my. Check for a membership first and send them there; the wall is for
// people who genuinely have nowhere to go (soul.com, 2026-09-09).

async function holdsMembership(): Promise<boolean> {
  const supabase = await serverSupabase();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return false;
  try {
    const r = await publicFetch<{ items?: unknown[]; products?: unknown[] }>(
      '/api/v1/membership/portal/me',
      { headers: { Authorization: `Bearer ${session.access_token}` } },
    );
    return (r.items?.length ?? 0) > 0 || (r.products?.length ?? 0) > 0;
  } catch {
    return false;
  }
}

export default async function NoAccess() {
  if (await holdsMembership()) redirect('/my');

  const fibreUrl = process.env.NEXT_PUBLIC_FIBRE_URL ?? 'https://thefibre.app';
  return (
    <main className="min-h-screen bg-white text-neutral-900">
      <div className="mx-auto max-w-xl px-6 py-20">
        <div className="text-xs uppercase tracking-[0.18em] text-neutral-500">
          Membership
        </div>
        <h1 className="mt-3 text-3xl font-medium tracking-tight">
          Nothing to open here yet
        </h1>
        <p className="mt-4 text-neutral-600 leading-relaxed">
          This is the admin side of Membership, and your account has no seat in
          a workspace that runs it. If you joined a community, your membership,
          invoices and payment details live on your own page.
        </p>
        <div className="mt-10 flex flex-wrap items-center gap-5">
          <Link
            href="/my"
            className="rounded-md bg-neutral-900 text-white px-5 py-2.5 text-sm font-medium hover:bg-neutral-800"
          >
            See your membership
          </Link>
          <Link
            href={`${fibreUrl}/request-access`}
            className="text-sm text-neutral-600 hover:text-neutral-900 underline underline-offset-4"
          >
            Apply for a Fibre account
          </Link>
          <Link
            href={fibreUrl}
            className="text-sm text-neutral-600 hover:text-neutral-900 underline underline-offset-4"
          >
            Open The Fibre →
          </Link>
        </div>
        <p className="mt-8 text-sm text-neutral-500">
          Run a community and expecting the admin side? Ask your workspace
          admin to switch Membership on under <em>Settings → Apps</em>.
        </p>
      </div>
    </main>
  );
}
