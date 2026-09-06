'use client';

import { useState } from 'react';
import { t, type Locale, type UiKey } from '@/lib/i18n-ui';
import { GrantDialog } from './grant-dialog';
import { grantTierName, type Grant, type GrantKind } from './types';
import type { Tier } from '../tiers/types';

const GRANT_KIND_KEYS: Record<GrantKind, UiKey> = {
  circle: 'grant_kind_circle',
  thread: 'grant_kind_thread',
  fibre_seat: 'grant_kind_fibre_seat',
  google_user: 'grant_kind_google_user',
};

export function AccessClient({
  grants,
  tiers,
  circleTokenSet,
  locale,
}: {
  grants: Grant[];
  tiers: Tier[];
  circleTokenSet: boolean;
  locale: Locale;
}) {
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Grant | null>(null);

  // Group by tier, in tier sort order; grants on unknown (archived) tiers
  // last. Product-attached grants (the norm since 2026-09-05) group under
  // the synthetic 'products' bucket — their tiers follow from which tiers
  // include the product.
  const byTier = new Map<string, Grant[]>();
  for (const g of grants) {
    const key = g.tier_id ?? 'products';
    const list = byTier.get(key) ?? [];
    list.push(g);
    byTier.set(key, list);
  }
  const knownTierIds = new Set(tiers.map((x) => x.id));
  const orphanTierIds = [...byTier.keys()].filter((id) => !knownTierIds.has(id));

  const hasCircleGrant = grants.some((g) => g.kind === 'circle');

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-ink">
            {t(locale, 'nav_access')}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">{t(locale, 'access_blurb')}</p>
        </div>
        {/* No add-button here: access is configured ON PRODUCTS (decided
            2026-09-05). The legacy tier-level rows below stay visible until
            they're moved onto products, but new ones can't be created —
            the button confused more than it helped (Sjoerd, 2026-09-06:
            "what does the right top mean?"). */}
      </div>

      {hasCircleGrant && !circleTokenSet && (
        <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-900/40">
          {t(locale, 'circle_token_warning')}
        </div>
      )}

      {grants.length === 0 ? (
        <div className="mt-10 rounded-2xl bg-surface-raised border border-line p-8 text-center">
          <p className="text-sm text-ink-muted">{t(locale, 'access_empty')}</p>
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          {tiers
            .filter((x) => (byTier.get(x.id) ?? []).length > 0)
            .map((x) => (
              <TierGroup
                key={x.id}
                title={t(locale, 'tier_level_legacy', { name: x.name })}
                items={byTier.get(x.id) ?? []}
                locale={locale}
                onEdit={setEditing}
              />
            ))}
          {orphanTierIds.map((id) => (
            <TierGroup
              key={id}
              title={grantTierName(byTier.get(id)?.[0]?.tier ?? null, t(locale, 'unknown_tier'))}
              items={byTier.get(id) ?? []}
              locale={locale}
              onEdit={setEditing}
            />
          ))}
        </div>
      )}

      {creating && (
        <GrantDialog
          grant={null}
          tiers={tiers}
          circleTokenSet={circleTokenSet}
          locale={locale}
          onClose={() => setCreating(false)}
        />
      )}
      {editing && (
        <GrantDialog
          grant={editing}
          tiers={tiers}
          circleTokenSet={circleTokenSet}
          locale={locale}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}

function grantTarget(g: Grant): string {
  const config = g.config ?? {};
  const ref = g.kind === 'circle' ? config.space_id : config.thread_slug;
  return typeof ref === 'string' || typeof ref === 'number' ? String(ref) : '—';
}

function TierGroup({
  title,
  items,
  locale,
  onEdit,
}: {
  title: string;
  items: Grant[];
  locale: Locale;
  onEdit: (g: Grant) => void;
}) {
  return (
    <div className="rounded-2xl bg-surface-raised border border-line">
      <div className="px-5 py-3 border-b border-line text-sm font-semibold tracking-tight">
        {t(locale, 'group_unlocks', { title })}
      </div>
      <div className="divide-y divide-line/60">
        {items.map((g) => (
          <button
            key={g.id}
            type="button"
            onClick={() => onEdit(g)}
            className="w-full text-left px-5 py-3 hover:bg-surface-sunken focus:outline-none focus-visible:bg-surface-sunken"
          >
            <div className="text-sm text-ink">
              {t(locale, GRANT_KIND_KEYS[g.kind])}
              <span className="text-ink-subtle"> · {grantTarget(g)}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
