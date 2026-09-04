'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GrantDialog } from './grant-dialog';
import { GRANT_KIND_LABELS, grantTierName, type Grant } from './types';
import type { Tier } from '../tiers/types';

export function AccessClient({
  grants,
  tiers,
  circleTokenSet,
}: {
  grants: Grant[];
  tiers: Tier[];
  circleTokenSet: boolean;
}) {
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Grant | null>(null);

  // Group by tier, in tier sort order; grants on unknown (archived) tiers last.
  const byTier = new Map<string, Grant[]>();
  for (const g of grants) {
    const list = byTier.get(g.tier_id) ?? [];
    list.push(g);
    byTier.set(g.tier_id, list);
  }
  const knownTierIds = new Set(tiers.map((t) => t.id));
  const orphanTierIds = [...byTier.keys()].filter((id) => !knownTierIds.has(id));

  const hasCircleGrant = grants.some((g) => g.kind === 'circle');

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-ink">Access</h1>
          <p className="mt-1 text-sm text-ink-muted">
            What each tier unlocks — Circle spaces and Threads are granted when a member joins
            and revoked when they lapse.
          </p>
        </div>
        <Button leading={<Plus size={16} strokeWidth={2} />} onClick={() => setCreating(true)}>
          New grant
        </Button>
      </div>

      {hasCircleGrant && !circleTokenSet && (
        <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-900/40">
          Add your Circle API token in Settings for this grant to sync.
        </div>
      )}

      {grants.length === 0 ? (
        <div className="mt-10 rounded-2xl bg-surface-raised border border-line p-8 text-center">
          <p className="text-sm text-ink-muted">
            No grants yet. Add one to connect a tier to a Circle space or a Thread.
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          {tiers
            .filter((t) => (byTier.get(t.id) ?? []).length > 0)
            .map((t) => (
              <TierGroup
                key={t.id}
                title={t.name}
                items={byTier.get(t.id) ?? []}
                onEdit={setEditing}
              />
            ))}
          {orphanTierIds.map((id) => (
            <TierGroup
              key={id}
              title={grantTierName(byTier.get(id)?.[0]?.tier ?? null)}
              items={byTier.get(id) ?? []}
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
          onClose={() => setCreating(false)}
        />
      )}
      {editing && (
        <GrantDialog
          grant={editing}
          tiers={tiers}
          circleTokenSet={circleTokenSet}
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
  onEdit,
}: {
  title: string;
  items: Grant[];
  onEdit: (g: Grant) => void;
}) {
  return (
    <div className="rounded-2xl bg-surface-raised border border-line">
      <div className="px-5 py-3 border-b border-line text-sm font-semibold tracking-tight">
        {title} unlocks:
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
              {GRANT_KIND_LABELS[g.kind]}
              <span className="text-ink-subtle"> · {grantTarget(g)}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
