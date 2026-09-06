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

  const qs = new URLSearchParams({ limit: '100' });
  if (status) qs.set('status', status);
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
