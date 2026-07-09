'use client';

// The cashflow TAB system (Sjoerd 2026-07-09: "a TAB system: Me is always
// there. Workspace only if you are SUPER ADMIN or added by the super
// admin... a tab for each team you are part of if the team lead created a
// cashflow"). The tab bar IS the chooser — it replaced the entry-card
// chooser and the header scope switcher. A tab navigates the existing scope
// URLs (?scope=me / ?team=<id> / bare) and persists the cookie; the active
// tab is the current scope.
//
// The green + / red − quick-adds moved out of the tab bar into the grid's
// controls cluster (Sjoerd 2026-07-09 layout pass) — see view-controls.tsx.

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { savePref } from '@/lib/prefs-actions';
import { COOKIE_CASHFLOW_SCOPE } from '@/lib/prefs-shared';
import type { CashflowScope } from './types';

export type TabDef = { key: string; label: string; cookieVal: string; url: string };

export function CashflowTabs({
  scope,
  scopeTeamId,
  canWorkspace,
  workspaceName,
  teams,
}: {
  scope: CashflowScope;
  scopeTeamId: string | null;
  canWorkspace: boolean;
  // The company's own name on its tab (Sjoerd 2026-07-10) — falls back to 'Workspace'.
  workspaceName?: string | null;
  // Involved teams the caller can see (RLS-scoped) — one tab each.
  teams: { id: string; name: string }[];
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
      ? [{ key: 'workspace', label: workspaceName || 'Workspace', cookieVal: 'workspace', url: urlFor({}) }]
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
    <div className="border-b border-line">
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
    </div>
  );
}
