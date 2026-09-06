import { apiFetch } from '@/lib/api';
import { uiLocale } from '@/lib/locale';
import { AccessClient } from './access-client';
import type { Grant } from './types';
import type { Tier } from '../tiers/types';

export const metadata = { title: 'Access · Membership' };

type Settings = {
  circle_community_url: string | null;
  circle_api_token_set: boolean;
  join_page: Record<string, unknown>;
};

export default async function AccessPage() {
  let grants: Grant[] = [];
  let tiers: Tier[] = [];
  try {
    const [gR, tR] = await Promise.all([
      apiFetch<{ items: Grant[] }>('/api/v1/membership/grants'),
      apiFetch<{ items: Tier[] }>('/api/v1/membership/tiers'),
    ]);
    grants = gR.items;
    tiers = tR.items;
  } catch {
    /* empty state below */
  }

  // Settings is admin-only (403 for organisers) — a failed read just means
  // we can't confirm a Circle token exists, so warn as if it doesn't.
  let circleTokenSet = false;
  try {
    const s = await apiFetch<Settings>('/api/v1/membership/settings');
    circleTokenSet = s.circle_api_token_set;
  } catch {
    /* treat as not set */
  }

  const locale = await uiLocale();

  return (
    <div className="px-6 py-10 max-w-5xl">
      <AccessClient grants={grants} tiers={tiers} circleTokenSet={circleTokenSet} locale={locale} />
    </div>
  );
}
