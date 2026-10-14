import { Suspense } from 'react';
import { apiFetch } from '@/lib/api';
import { uiLocale } from '@/lib/locale';
import { MembersClient } from './members-client';
import type { Member, Tier } from './types';

export const metadata = { title: 'Members · Membership' };

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; tier?: string; q?: string }>;
}) {
  const { status, tier, q } = await searchParams;
  const locale = await uiLocale();

  // DEFAULT TO ACTIVE (Sjoerd, 2026-10-14). "Who is a member" is the question
  // this page is opened to answer, and a list led by lapsed and cancelled
  // rows answers a different one.
  //
  // The filter lives in the URL, so the absent state had to take a meaning:
  // it means `active` now, and ALL has its own spelling, `?status=all`.
  // Without that, "show me everyone" would simply be unreachable — worse than
  // the complaint. An existing link carrying a real status is untouched, and
  // `?status=` (empty) still means All, as it always did.
  const effective = status === undefined ? 'active' : status;
  const qs = new URLSearchParams({ limit: '100' });
  if (effective && effective !== 'all') qs.set('status', effective);
  if (tier) qs.set('tier_id', tier);
  if (q) qs.set('q', q);

  let members: Member[] = [];
  let tiers: Tier[] = [];
  try {
    const [mR, tR] = await Promise.all([
      apiFetch<{ items: Member[] }>(`/api/v1/membership/members?${qs}`),
      apiFetch<{ items: Tier[] }>('/api/v1/membership/tiers'),
    ]);
    members = mR.items;
    tiers = tR.items;
  } catch {
    /* empty state below */
  }

  return (
    <div className="px-6 py-10 max-w-5xl">
      {/* useSearchParams in the client needs a Suspense boundary for prerender. */}
      <Suspense>
        <MembersClient members={members} tiers={tiers} locale={locale} />
      </Suspense>
    </div>
  );
}
