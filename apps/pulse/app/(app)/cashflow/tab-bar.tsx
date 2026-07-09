'use client';

// The cashflow TAB system (Sjoerd 2026-07-09: "a TAB system: Me is always
// there. Workspace only if you are SUPER ADMIN or added by the super
// admin... a tab for each team you are part of if the team lead created a
// cashflow"). The tab bar IS the chooser — it replaced the entry-card
// chooser and the header scope switcher. A tab navigates the existing scope
// URLs (?scope=me / ?team=<id> / bare) and persists the cookie; the active
// tab is the current scope.
//
// At the right end: a green + and a red − (Sjoerd: "green + and a red −,
// with hover instructions... everything is now more or less a quick add") —
// they open the opportunity dialog with the direction preset.

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Minus, Plus } from 'lucide-react';
import { savePref } from '@/lib/prefs-actions';
import { COOKIE_CASHFLOW_SCOPE } from '@/lib/prefs-shared';
import type { CashflowScope } from './types';

export type TabDef = { key: string; label: string; cookieVal: string; url: string };

export function CashflowTabs({
  scope,
  scopeTeamId,
  canWorkspace,
  teams,
  onAdd,
}: {
  scope: CashflowScope;
  scopeTeamId: string | null;
  canWorkspace: boolean;
  // Involved teams the caller can see (RLS-scoped) — one tab each.
  teams: { id: string; name: string }[];
  onAdd: (direction: 'in' | 'out') => void;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [busy, setBusy] = useState(false);

  // Preserve display params (?show=…) across tab switches; the scope params
  // are the tab's own.
  function urlFor(scopeParams: Record<string, string>): string {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('scope');
    params.delete('team');
    for (const [k, v] of Object.entries(scopeParams)) params.set(k, v);
    const qs = params.toString();
    return qs ? `/cashflow?${qs}` : '/cashflow';
  }

  const tabs: TabDef[] = [
    { key: 'me', label: 'Me', cookieVal: 'me', url: urlFor({ scope: 'me' }) },
    ...teams.map((t) => ({
      key: `team:${t.id}`,
      label: t.name,
      cookieVal: `team:${t.id}`,
      url: urlFor({ team: t.id }),
    })),
    ...(canWorkspace
      ? [{ key: 'workspace', label: 'Workspace', cookieVal: 'workspace', url: urlFor({}) }]
      : []),
  ];

  const activeKey =
    scope === 'me' ? 'me' : scope === 'team' && scopeTeamId ? `team:${scopeTeamId}` : 'workspace';

  async function go(tab: TabDef) {
    if (busy || tab.key === activeKey) return;
    setBusy(true);
    // The cookie must land BEFORE the target render (the bare workspace URL
    // resolves from it); refresh covers the push-to-same-URL case.
    await savePref(COOKIE_CASHFLOW_SCOPE, tab.cookieVal);
    router.push(tab.url);
    router.refresh();
    setBusy(false);
  }

  return (
    <div className="flex items-end justify-between gap-4 border-b border-line">
      <div role="tablist" aria-label="Cashflows" className="flex items-end gap-1 overflow-x-auto">
        {tabs.map((t) => {
          const active = t.key === activeKey;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={active}
              disabled={busy}
              onClick={() => void go(t)}
              className={`-mb-px whitespace-nowrap rounded-t-lg border-b-2 px-3.5 py-2 text-sm transition-colors ${
                active
                  ? 'border-ink font-semibold text-ink'
                  : 'border-transparent font-medium text-ink-subtle hover:border-line-strong hover:text-ink'
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      <div className="flex shrink-0 items-center gap-2 pb-1.5">
        <button
          type="button"
          onClick={() => onAdd('in')}
          title="Add income — a contact and an amount is enough"
          aria-label="Add income"
          className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600 text-white shadow-sm transition-colors hover:bg-emerald-700"
        >
          <Plus size={16} strokeWidth={2.5} />
        </button>
        <button
          type="button"
          onClick={() => onAdd('out')}
          title="Add a cost"
          aria-label="Add a cost"
          className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-rose-600 text-white shadow-sm transition-colors hover:bg-rose-700"
        >
          <Minus size={16} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}
