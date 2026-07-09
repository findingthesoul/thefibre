'use client';

import { useState } from 'react';
import { OpportunityDialog } from './opportunity-dialog';
import { OrgDialog } from './org-dialog';
import { PeriodGrid } from './period-grid';
import { CounterpartyTable } from './counterparty-table';
import { CashflowTabs } from './tab-bar';
import { BankPrompt } from './bank-prompt';
import { ToastStack } from './toast';
import {
  AddButtons,
  FilteredNote,
  InvoiceFilterSelect,
  ViewSelect,
  type InvoiceFilter,
} from './view-controls';
import { savePref } from '@/lib/prefs-actions';
import { COOKIE_CASHFLOW_VIEW } from '@/lib/prefs-shared';
import {
  scopeKeyFor,
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
  // "Only invoiced" / "Not invoiced" — income rows only, both views; totals
  // stay over ALL rows (the honesty note next to the select says so).
  const [invoiceFilter, setInvoiceFilter] = useState<InvoiceFilter>('all');
  // On-demand bank-balances popup (the BANK header's "Update balances") —
  // the same dialog the first-visit-of-the-day prompt opens.
  const [bankOpen, setBankOpen] = useState(false);
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

  // The tab list: Me first, then every involved team the caller can see,
  // then Workspace (gated on canWorkspace). A team scope pointing outside
  // the involved list (deep link) still gets its tab so the bar shows where
  // you are — name resolved via the workspace team list.
  const tabTeams = pickers.teams.map((t) => ({ value: t.team_id, label: teamName(t.team) }));
  if (scope === 'team' && scopeTeamId && !tabTeams.some((t) => t.value === scopeTeamId)) {
    tabTeams.push({
      value: scopeTeamId,
      label: pickers.allTeams.find((t) => t.id === scopeTeamId)?.name ?? 'Current team',
    });
  }
  const scopeKey = scopeKeyFor(scope, scopeTeamId);
  // The active tab's display name — bank creation names the account after it.
  const tabName =
    scope === 'me'
      ? 'Me'
      : scope === 'team'
        ? (tabTeams.find((t) => t.value === scopeTeamId)?.label ?? 'Team')
        : 'Workspace';

  // The view choice is a compact select in the controls row now — remembered
  // per user, same cookie as before.
  function changeView(next: 'counterparty' | 'period') {
    setView(next);
    void savePref(COOKIE_CASHFLOW_VIEW, next);
  }

  return (
    <>
      {/* Server/API errors from anywhere in the lane pop here (toast.tsx). */}
      <ToastStack />
      {/* Title FIRST, full width (Sjoerd 2026-07-09: "CASHFLOW title above
          the tabs"); the tab bar sits on its own row below it. */}
      <div className="max-w-6xl">
        <h1 className="text-[28px] font-semibold tracking-tight text-ink">Cashflow</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Expected money in and out, per contact — every line weighted by where it stands in the pipeline (a Fibre Flow).
        </p>
      </div>
      {/* One cashflow per tab (Sjoerd 2026-07-09) — the tab bar IS the
          chooser AND the switcher. The quick adds live in the controls row. */}
      <div className="mt-5 max-w-6xl">
        <CashflowTabs
          scope={scope}
          scopeTeamId={scopeTeamId}
          canWorkspace={canWorkspace}
          teams={tabTeams.map((t) => ({ id: t.value, name: t.label }))}
        />
      </div>
      {/* The bank-balances popup — auto on the first visit of the day, and
          on demand from the BANK header (balances edit HERE, not in rows). */}
      <BankPrompt
        key={scopeKey}
        accounts={accounts}
        scopeKey={scopeKey}
        open={bankOpen}
        onClose={() => setBankOpen(false)}
      />

      {view === 'period' ? (
        <PeriodGrid
          items={items}
          settings={periodSettings}
          stages={pickers.stages}
          projection={projection}
          budgetLines={budgetLines}
          accounts={accounts}
          initialFit={initialFit}
          scope={scope}
          scopeTeamId={scopeTeamId}
          currentUserId={currentUserId}
          tabName={tabName}
          view={view}
          onViewChange={changeView}
          invoiceFilter={invoiceFilter}
          onInvoiceFilterChange={setInvoiceFilter}
          onEdit={setEditing}
          onAdd={(direction) => setCreating({ direction })}
          onOpenGroup={setOrgKey}
          onUpdateBalances={() => setBankOpen(true)}
        />
      ) : (
        <>
          {/* Same controls-row contract as the period grid: [invoice filter]
              left, [+ −] [view select] right (the period-only Show / fit /
              chevrons don't apply here). */}
          <div className="mt-6 mb-3 flex max-w-6xl items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <InvoiceFilterSelect value={invoiceFilter} onChange={setInvoiceFilter} />
              {invoiceFilter !== 'all' && <FilteredNote />}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <AddButtons onAdd={(direction) => setCreating({ direction })} />
              <ViewSelect value={view} onChange={changeView} />
            </div>
          </div>
          {items.length === 0 ? (
            <div className="mt-10 rounded-2xl bg-white ring-1 ring-black/5 shadow-card p-8 text-center">
              <p className="text-sm text-ink-muted">
                Nothing here yet. Add your first with the green + above — a contact and an
                amount is enough.
              </p>
            </div>
          ) : (
            // Inline-editable, line per line (Sjoerd 2026-07-08) — the pencil at
            // the row end opens the full dialog.
            <CounterpartyTable
              items={items}
              stages={pickers.stages}
              invoiceFilter={invoiceFilter}
              onEdit={setEditing}
              onOpenGroup={setOrgKey}
            />
          )}
        </>
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
