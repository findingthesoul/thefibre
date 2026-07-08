'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { OpportunityDialog } from './opportunity-dialog';
import { OrgDialog } from './org-dialog';
import { QuickAddButton } from './quick-add';
import { PeriodGrid } from './period-grid';
import { CounterpartyTable } from './counterparty-table';
import { savePref } from '@/lib/prefs-actions';
import { COOKIE_CASHFLOW_SCOPE, COOKIE_CASHFLOW_VIEW } from '@/lib/prefs-shared';
import {
  teamName,
  type BudgetLine,
  type CashflowScope,
  type Commitment,
  type PeriodSettings,
  type Pickers,
  type Projection,
  type PulseAccount,
} from './types';

// New-item dialog state — the org popup's + Add carries the counterparty it
// was opened for so the pickers come preselected.
type Creating = { direction: 'in' | 'out'; orgId?: string; personId?: string };

export function PipelineView({
  items,
  pickers,
  currentUserId,
  periodSettings,
  projection,
  budgetLines,
  accounts,
  initialView,
  initialFit,
  scope,
  scopeTeamId,
  canWorkspace,
}: {
  items: Commitment[];
  pickers: Pickers;
  currentUserId: string | null;
  periodSettings: PeriodSettings;
  // Admin-only reads — null/empty for non-admins; the grid degrades to
  // INCOME + COSTS without the position/reserves/end rows.
  projection: Projection | null;
  budgetLines: BudgetLine[];
  accounts: PulseAccount[];
  initialView: 'counterparty' | 'period';
  initialFit: 'on' | 'off';
  // Me / Team / Workspace (Sjoerd 2026-07-08: "cashflow per team... or per
  // person or per workspace, and workspace only visible to the ones who
  // have access") — resolved server-side in page.tsx (URL params + cookie).
  scope: CashflowScope;
  scopeTeamId: string | null;
  canWorkspace: boolean;
}) {
  const [creating, setCreating] = useState<Creating | null>(null);
  const [editing, setEditing] = useState<Commitment | null>(null);
  const [view, setView] = useState<'counterparty' | 'period'>(initialView);
  // The per-org popup, keyed by counterparty key (org id / person id). Kept
  // as a KEY, not a snapshot: its contents recompute from `items` on every
  // render, so an inner-dialog save (router.refresh()) refreshes the lists.
  const [orgKey, setOrgKey] = useState<string | null>(null);

  const innerOpen = creating !== null || editing !== null;

  // Recompute the open org group's identity + items from the live props.
  const orgItems = orgKey ? items.filter((cm) => (cm.organisation?.id ?? cm.person?.id ?? '—') === orgKey) : [];
  const orgFirst = orgItems[0];
  const orgName =
    orgFirst?.organisation?.name ??
    (orgFirst?.person
      ? `${orgFirst.person.first_name ?? ''} ${orgFirst.person.last_name ?? ''}`.trim() ||
        orgFirst.person.email ||
        'Unnamed'
      : null) ??
    pickers.orgs.find((o) => o.id === orgKey)?.name ??
    'Counterparty';
  const orgIsOrganisation = orgFirst ? !!orgFirst.organisation : pickers.orgs.some((o) => o.id === orgKey);

  return (
    <>
      <div className="flex items-start justify-between gap-4 max-w-6xl">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-ink">Cashflow</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Expected money in and out, per counterparty — every line weighted by where it stands in the pipeline (a Fibre Flow).
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <ScopeSwitcher
            scope={scope}
            scopeTeamId={scopeTeamId}
            canWorkspace={canWorkspace}
            pickers={pickers}
          />
          <QuickAddButton orgs={pickers.orgs} persons={pickers.persons} />
          <Button variant="secondary" onClick={() => setCreating({ direction: 'out' })}>
            New cost
          </Button>
          <Button
            leading={<Plus size={16} strokeWidth={2} />}
            onClick={() => setCreating({ direction: 'in' })}
          >
            New income
          </Button>
        </div>
      </div>

      {/* View toggle — list per counterparty vs. draggable per-period board. */}
      <div className="mt-6 inline-flex rounded-lg ring-1 ring-line bg-surface-raised p-0.5">
        {(
          [
            ['counterparty', 'By counterparty'],
            ['period', 'By period'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              setView(key);
              void savePref(COOKIE_CASHFLOW_VIEW, key); // remembered per user
            }}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              view === key
                ? 'bg-ink text-ink-inverse'
                : 'text-ink-subtle hover:text-ink'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {view === 'period' ? (
        <PeriodGrid
          items={items}
          settings={periodSettings}
          stages={pickers.stages}
          projection={projection}
          budgetLines={budgetLines}
          accounts={accounts}
          initialFit={initialFit}
          onEdit={setEditing}
          onAdd={(direction) => setCreating({ direction })}
          onOpenGroup={setOrgKey}
        />
      ) : items.length === 0 ? (
        <div className="mt-10 rounded-2xl bg-white ring-1 ring-black/5 shadow-card p-8 text-center">
          <p className="text-sm text-ink-muted">
            Nothing here yet. Add your first with New income — the importer seeds your
            current spreadsheet.
          </p>
        </div>
      ) : (
        // Inline-editable, line per line (Sjoerd 2026-07-08) — the pencil at
        // the row end opens the full dialog.
        <CounterpartyTable
          items={items}
          stages={pickers.stages}
          onEdit={setEditing}
          onOpenGroup={setOrgKey}
        />
      )}

      {/* Per-org popup (Sjoerd: "I want per org a popup") — rendered BEFORE
          the OpportunityDialogs so an inner dialog mounts later in the DOM
          and paints on top (same z-50, later sibling wins). Escape fires
          BOTH dialogs' document listeners — the guard below ignores this
          outer close while an inner dialog is open, so Escape only closes
          the top one. Body scroll-lock nests correctly: the inner dialog
          restores the OUTER's 'hidden' on unmount, not ''. */}
      {orgKey && (
        <OrgDialog
          name={orgName}
          items={orgItems}
          stages={pickers.stages}
          onOpenItem={setEditing}
          onAdd={() =>
            setCreating({
              direction: 'in',
              ...(orgIsOrganisation ? { orgId: orgKey } : { personId: orgKey }),
            })
          }
          onClose={() => {
            if (innerOpen) return; // Escape/backdrop is the inner dialog's to handle
            setOrgKey(null);
          }}
        />
      )}

      {creating && (
        <OpportunityDialog
          commitment={null}
          initialDirection={creating.direction}
          initialOrgId={creating.orgId}
          initialPersonId={creating.personId}
          pickers={pickers}
          currentUserId={currentUserId}
          onClose={() => setCreating(null)}
        />
      )}
      {editing && (
        <OpportunityDialog
          commitment={editing}
          pickers={pickers}
          currentUserId={currentUserId}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}

// Me / Team / Workspace segmented control. Wired via URL params (?scope=me |
// ?team=<id> | none = workspace) so the server refetches + refilters; the
// last choice persists in a cookie. Non-admins (projection fetch failed)
// don't get the Workspace option.
function ScopeSwitcher({
  scope,
  scopeTeamId,
  canWorkspace,
  pickers,
}: {
  scope: CashflowScope;
  scopeTeamId: string | null;
  canWorkspace: boolean;
  pickers: Pickers;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Involved teams preferred; fall back to ALL active workspace teams so the
  // select is never empty (same rule as the dialog's team picker).
  const involved = pickers.teams.map((t) => ({ value: t.team_id, label: teamName(t.team) }));
  const teamOptions =
    involved.length > 0
      ? involved
      : pickers.allTeams.filter((t) => t.is_active).map((t) => ({ value: t.id, label: t.name }));

  function go(next: CashflowScope, teamId?: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('scope');
    params.delete('team');
    let cookieVal = 'workspace';
    if (next === 'me') {
      params.set('scope', 'me');
      cookieVal = 'me';
    } else if (next === 'team') {
      const t = teamId ?? scopeTeamId ?? teamOptions[0]?.value;
      if (!t) return; // no teams to scope by
      params.set('team', t);
      cookieVal = `team:${t}`;
    }
    void savePref(COOKIE_CASHFLOW_SCOPE, cookieVal); // remembered per user
    const qs = params.toString();
    router.push(qs ? `/cashflow?${qs}` : '/cashflow');
  }

  const segments: { key: CashflowScope; label: string; show: boolean }[] = [
    { key: 'me', label: 'Me', show: true },
    { key: 'team', label: 'Team', show: teamOptions.length > 0 },
    { key: 'workspace', label: 'Workspace', show: canWorkspace },
  ];

  return (
    <div className="flex items-center gap-2">
      <div className="inline-flex rounded-lg ring-1 ring-line bg-surface-raised p-0.5">
        {segments
          .filter((s) => s.show)
          .map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => go(s.key)}
              aria-pressed={scope === s.key}
              className={`px-2.5 py-1.5 rounded-md text-sm font-medium transition-colors ${
                scope === s.key ? 'bg-ink text-ink-inverse' : 'text-ink-subtle hover:text-ink'
              }`}
            >
              {s.label}
            </button>
          ))}
      </div>
      {scope === 'team' && (
        <select
          value={scopeTeamId ?? ''}
          onChange={(e) => go('team', e.target.value)}
          aria-label="Team to show"
          className="rounded-md border border-line bg-surface-raised px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300"
        >
          {scopeTeamId && !teamOptions.some((t) => t.value === scopeTeamId) && (
            <option value={scopeTeamId}>Current team</option>
          )}
          {teamOptions.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
