'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowDownLeft, ArrowUpRight, Plus, X } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { DateField } from '@/components/ui/date-field';
import { money } from '@/lib/money';
import {
  saveCommitment,
  deleteCommitment,
  createOrganisation,
  createPerson,
  type LinePayload,
} from './actions';
import { Combobox, type ComboCreateResult } from './combobox';
import {
  personName,
  teamName,
  type Commitment,
  type OrgOption,
  type PersonOption,
  type Pickers,
} from './types';

const INPUT =
  'w-full rounded-md border border-line bg-surface-raised px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300';
const INPUT_SM =
  'w-full rounded-md border border-line bg-surface-raised px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300';

// Euros displayed ↔ integer cents stored. Comma decimals accepted.
function toCents(s: string): number | null {
  const n = parseFloat(s.trim().replace(',', '.'));
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}
function fromCents(c: number): string {
  return (c / 100).toFixed(2);
}

type Row = {
  key: number;
  id?: string;
  expected_date: string;
  amount: string;
  invoice_ref: string;
  invoiced_at: string;
  settled_at: string;
};

let rowSeq = 0;

export function OpportunityDialog({
  commitment,
  initialDirection,
  pickers,
  currentUserId,
  onClose,
}: {
  commitment: Commitment | null; // null = new
  initialDirection?: 'in' | 'out';
  pickers: Pickers;
  currentUserId: string | null;
  onClose: () => void;
}) {
  const router = useRouter();

  const sortedStages = [...pickers.stages].sort((a, b) => a.sort_order - b.sort_order);

  const [direction, setDirection] = useState<'in' | 'out'>(
    commitment?.direction ?? initialDirection ?? 'in',
  );
  const [label, setLabel] = useState(commitment?.label ?? '');
  const [orgId, setOrgId] = useState(commitment?.organisation_id ?? '');
  const [personId, setPersonId] = useState(commitment?.person_id ?? '');
  // Local copies so an inline "Create '<query>'" shows up immediately.
  const [orgs, setOrgs] = useState<OrgOption[]>(pickers.orgs);
  const [persons, setPersons] = useState<PersonOption[]>(pickers.persons);
  const [teamId, setTeamId] = useState(commitment?.team_id ?? '');
  const [projectId, setProjectId] = useState(commitment?.project_id ?? '');
  const [offeringId, setOfferingId] = useState(commitment?.offering_id ?? '');
  // Deal size as quantity × unit price (the workbook's "16 × product X").
  const [quantity, setQuantity] = useState(
    commitment ? String(commitment.quantity ?? 1) : '1',
  );
  const [unitAmount, setUnitAmount] = useState(
    commitment?.unit_amount_cents != null
      ? (commitment.unit_amount_cents / 100).toFixed(2).replace('.', ',')
      : '',
  );
  // New opportunities default to the signed-in user when they're a member;
  // '' keeps the API default (caller on create / unchanged on edit).
  const [ownerId, setOwnerId] = useState(
    commitment?.owner_user_id ??
      (currentUserId && pickers.members.some((m) => m.user_id === currentUserId)
        ? currentUserId
        : ''),
  );
  const [stage, setStage] = useState<string>(
    commitment?.stage ?? sortedStages[0]?.key ?? 'lead',
  );
  const [probability, setProbability] = useState(commitment?.probability ?? 50);
  const [notes, setNotes] = useState(commitment?.notes ?? '');
  const [rows, setRows] = useState<Row[]>(() =>
    [...(commitment?.lines ?? [])]
      .sort((a, b) => a.expected_date.localeCompare(b.expected_date))
      .map((l) => ({
        key: rowSeq++,
        id: l.id,
        expected_date: l.expected_date,
        amount: fromCents(l.amount_cents),
        invoice_ref: l.invoice_ref ?? '',
        invoiced_at: l.invoiced_at ?? '',
        settled_at: l.settled_at ?? '',
      })),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // A committed/won KIND implies certainty — the API forces 100 too.
  const selectedStage = sortedStages.find((s) => s.key === stage);
  const probabilityLocked =
    selectedStage?.kind === 'committed' || selectedStage?.kind === 'won';
  // Editing a row whose stage key vanished from the flow: keep it selectable
  // rather than silently moving the opportunity.
  const stageOptions = selectedStage
    ? sortedStages
    : [
        ...sortedStages,
        { id: stage, key: stage, label: stage, kind: 'open', sort_order: 999, is_system: false },
      ];

  const orgOptions = orgs.map((o) => ({ id: o.id, label: o.name }));
  const personOptions = persons.map((p) => ({
    id: p.id,
    label: personName(p),
    sublabel: p.email,
  }));

  async function handleCreateOrg(query: string): Promise<ComboCreateResult> {
    const res = await createOrganisation(query.trim());
    if (res.error || !res.data) return { error: res.error ?? 'unknown error' };
    const created = res.data;
    setOrgs((os) => [...os, { id: created.id, name: created.name }]);
    return { option: { id: created.id, label: created.name } };
  }

  async function handleCreatePerson(query: string, email?: string): Promise<ComboCreateResult> {
    const mail = (email ?? '').trim();
    if (!/^\S+@\S+\.\S+$/.test(mail)) {
      return { error: 'A valid email is required to create a person.' };
    }
    const res = await createPerson({ query, email: mail });
    if (res.error || !res.data) return { error: res.error ?? 'unknown error' };
    const created = res.data;
    setPersons((ps) => [...ps, created]);
    return { option: { id: created.id, label: personName(created), sublabel: created.email } };
  }

  const total = rows.reduce((acc, r) => acc + (toCents(r.amount) ?? 0), 0);

  // Involved teams are preferred; when none are marked yet the select falls
  // back to ALL active workspace teams so it's never empty.
  const involvedTeamOptions = pickers.teams.map((t) => ({
    value: t.team_id,
    label: teamName(t.team),
  }));
  const showingAllTeams = involvedTeamOptions.length === 0;
  const teamOptions = showingAllTeams
    ? pickers.allTeams.filter((t) => t.is_active).map((t) => ({ value: t.id, label: t.name }))
    : involvedTeamOptions;
  // Editing a commitment whose team isn't in the list (not involved / now
  // inactive): keep it selectable rather than silently blanking the select.
  if (teamId && !teamOptions.some((t) => t.value === teamId)) {
    teamOptions.push({
      value: teamId,
      label: pickers.allTeams.find((t) => t.id === teamId)?.name ?? 'Current team',
    });
  }

  const teamProjects = teamId ? pickers.projects.filter((p) => p.team_id === teamId) : [];
  const otherProjects = teamId
    ? pickers.projects.filter((p) => p.team_id !== teamId)
    : pickers.projects;

  function patchRow(key: number, patch: Partial<Row>) {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  // "Label of an opportunity is: project/offering" — picking one prefills an
  // empty label with its name (still freely editable afterwards).
  function prefillLabel(name: string | undefined) {
    if (name && !label.trim()) setLabel(name);
  }

  async function submit(e?: React.FormEvent<HTMLFormElement>) {
    e?.preventDefault();
    if (!label.trim()) {
      setError('Label is required.');
      return;
    }

    // Build line payloads; blank rows are dropped, half-filled rows block save.
    const original = new Map((commitment?.lines ?? []).map((l) => [l.id, l]));
    const lines: LinePayload[] = [];
    for (const r of rows) {
      const empty =
        !r.expected_date && !r.amount.trim() && !r.invoice_ref.trim() && !r.invoiced_at && !r.settled_at;
      if (empty) continue;
      const cents = toCents(r.amount);
      if (!r.expected_date || cents === null) {
        setError('Each expected payment needs a date and an amount.');
        return;
      }
      const payload: LinePayload = {
        id: r.id,
        expected_date: r.expected_date,
        amount_cents: cents,
        invoice_ref: r.invoice_ref.trim() || null,
        invoiced_at: r.invoiced_at || null,
        settled_at: r.settled_at || null,
      };
      if (r.id) {
        const o = original.get(r.id);
        payload.dirty =
          !o ||
          o.expected_date !== payload.expected_date ||
          o.amount_cents !== payload.amount_cents ||
          (o.invoice_ref ?? null) !== payload.invoice_ref ||
          (o.invoiced_at ?? null) !== payload.invoiced_at ||
          (o.settled_at ?? null) !== payload.settled_at;
      }
      lines.push(payload);
    }

    setBusy(true);
    setError(null);
    const res = await saveCommitment({
      id: commitment?.id ?? null,
      commitment: {
        direction,
        label: label.trim(),
        person_id: personId || null,
        organisation_id: orgId || null,
        team_id: teamId || null,
        project_id: projectId || null,
        offering_id: offeringId || null,
        // Omitted = API defaults to the caller / keeps the current owner.
        ...(ownerId ? { owner_user_id: ownerId } : {}),
        // A cost is not an opportunity (Sjoerd 2026-07-08): no pipeline
        // semantics. New costs save as committed money; existing rows keep
        // their stored stage untouched.
        quantity: (() => {
          const q = parseFloat(quantity.replace(',', '.'));
          return Number.isFinite(q) && q > 0 ? q : 1;
        })(),
        unit_amount_cents: toCents(unitAmount),
        stage: direction === 'out' && !commitment ? 'committed' : stage,
        probability:
          direction === 'out' && !commitment ? 100 : probabilityLocked ? 100 : probability,
        notes: notes.trim() || null,
      },
      lines,
      originalLineIds: (commitment?.lines ?? []).map((l) => l.id),
    });
    if (res.error) {
      setError(res.error);
      setBusy(false);
      return;
    }
    onClose();
    router.refresh();
  }

  async function handleDelete() {
    if (!commitment) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setBusy(true);
    setError(null);
    const res = await deleteCommitment(commitment.id);
    if (res.error) {
      setError(res.error);
      setBusy(false);
      setConfirmDelete(false);
      return;
    }
    onClose();
    router.refresh();
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={
        direction === 'out'
          ? commitment
            ? 'Edit cost'
            : 'New cost'
          : commitment
            ? 'Edit opportunity'
            : 'New opportunity'
      }
      size="xl"
      footer={
        <>
          {commitment && (
            <Button
              type="button"
              variant="danger"
              className="mr-auto"
              disabled={busy}
              onClick={handleDelete}
            >
              {confirmDelete ? 'Really delete?' : 'Delete'}
            </Button>
          )}
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form="opportunity-form" disabled={busy}>
            {busy ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      <form id="opportunity-form" onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-[1fr_220px] gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Label</label>
            <input
              autoFocus
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Website rebuild — phase 2"
              className={INPUT}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Direction</label>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                aria-pressed={direction === 'in'}
                onClick={() => setDirection('in')}
                className={`inline-flex items-center justify-center gap-1.5 rounded-md px-2 py-2 text-sm font-medium ring-1 transition-colors ${
                  direction === 'in'
                    ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                    : 'text-ink-subtle ring-line hover:text-ink'
                }`}
              >
                <ArrowDownLeft size={15} strokeWidth={2} />
                Income
              </button>
              <button
                type="button"
                aria-pressed={direction === 'out'}
                onClick={() => setDirection('out')}
                className={`inline-flex items-center justify-center gap-1.5 rounded-md px-2 py-2 text-sm font-medium ring-1 transition-colors ${
                  direction === 'out'
                    ? 'bg-rose-50 text-rose-700 ring-rose-200'
                    : 'text-ink-subtle ring-line hover:text-ink'
                }`}
              >
                <ArrowUpRight size={15} strokeWidth={2} />
                Costs
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Organisation</label>
            <Combobox
              value={orgId}
              options={orgOptions}
              placeholder="No counterparty yet"
              emptyLabel="No counterparty yet"
              onSelect={(id) => {
                setOrgId(id);
                if (id) setPersonId('');
              }}
              onCreate={handleCreateOrg}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              Person <span className="font-normal text-ink-muted">(or)</span>
            </label>
            <Combobox
              value={personId}
              options={personOptions}
              placeholder="No counterparty yet"
              emptyLabel="No counterparty yet"
              onSelect={(id) => {
                setPersonId(id);
                if (id) setOrgId('');
              }}
              onCreate={handleCreatePerson}
              createExtraField={{ label: 'Email', placeholder: 'name@example.com' }}
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Team</label>
            <select value={teamId} onChange={(e) => setTeamId(e.target.value)} className={INPUT}>
              <option value="">—</option>
              {teamOptions.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            {showingAllTeams && teamOptions.length > 0 && (
              <p className="mt-1 text-xs text-ink-muted">
                Showing all teams — pick the involved teams in Settings to scope this list.
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Project</label>
            <select
              value={projectId}
              onChange={(e) => {
                setProjectId(e.target.value);
                prefillLabel(pickers.projects.find((p) => p.id === e.target.value)?.name);
              }}
              className={INPUT}
            >
              <option value="">—</option>
              {teamId ? (
                <>
                  <optgroup label="Team projects">
                    {teamProjects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </optgroup>
                  {otherProjects.length > 0 && (
                    <optgroup label="Other projects">
                      {otherProjects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </>
              ) : (
                pickers.projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))
              )}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Offering</label>
            <select
              value={offeringId}
              onChange={(e) => {
                setOfferingId(e.target.value);
                const off = pickers.offerings.find((o) => o.id === e.target.value);
                prefillLabel(off?.name);
                // Offering's default price prefills the unit price when empty.
                if (off?.default_amount_cents != null && !unitAmount.trim()) {
                  setUnitAmount((off.default_amount_cents / 100).toFixed(2).replace('.', ','));
                }
              }}
              className={INPUT}
            >
              <option value="">—</option>
              {pickers.offerings.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Deal size — quantity × unit price (e.g. 16 × product X @ €1.350). */}
        <div className="grid grid-cols-3 gap-4 items-end">
          <div>
            <label className="block text-sm font-medium mb-1">Quantity</label>
            <input
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              inputMode="decimal"
              className={INPUT}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Unit price €</label>
            <input
              value={unitAmount}
              onChange={(e) => setUnitAmount(e.target.value)}
              placeholder="0,00"
              inputMode="decimal"
              className={INPUT}
            />
          </div>
          <div className="pb-1">
            {(() => {
              const q = parseFloat(quantity.replace(',', '.'));
              const unit = toCents(unitAmount);
              const dealTotal =
                Number.isFinite(q) && q > 0 && unit != null ? Math.round(q * unit) : null;
              if (dealTotal == null || dealTotal === 0) {
                return <span className="text-xs text-ink-muted">= deal size</span>;
              }
              return (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-ink tabular-nums">
                    = {money(dealTotal)}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setRows((rs) => [
                        ...rs,
                        {
                          key: rowSeq++,
                          expected_date: new Date().toISOString().slice(0, 10),
                          amount: (dealTotal / 100).toFixed(2).replace('.', ','),
                          invoice_ref: '',
                          invoiced_at: '',
                          settled_at: '',
                        },
                      ])
                    }
                    className="text-xs text-ink-subtle underline underline-offset-2 hover:text-ink"
                  >
                    insert as payment
                  </button>
                </div>
              );
            })()}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Owner</label>
            <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)} className={INPUT}>
              <option value="">{commitment ? 'Unchanged' : 'Me'}</option>
              {pickers.members.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {m.full_name ?? m.email ?? m.user_id}
                </option>
              ))}
            </select>
          </div>
          {direction === 'in' ? (
            <>
              <div>
                <label className="block text-sm font-medium mb-1">Stage</label>
                <select value={stage} onChange={(e) => setStage(e.target.value)} className={INPUT}>
                  {stageOptions.map((s) => (
                    <option key={s.id} value={s.key}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Probability %</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={probabilityLocked ? 100 : probability}
                  disabled={probabilityLocked}
                  onChange={(e) => {
                    const n = parseInt(e.target.value, 10);
                    setProbability(Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0);
                  }}
                  className={`${INPUT} disabled:opacity-60`}
                />
              </div>
            </>
          ) : (
            <div className="col-span-2 flex items-end pb-2">
              <p className="text-xs text-ink-muted">
                Costs count in full — no pipeline stage. Repeating costs (and repeating income)
                live on the Budget page as recurring lines.
              </p>
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Optional"
            className={INPUT}
          />
        </div>

        {/* ---- Lines editor ------------------------------------------------ */}
        <div className="pt-4 border-t border-line">
          <div className="flex items-baseline justify-between">
            <h3 className="text-sm font-medium">Expected payments</h3>
            <span className="text-sm text-ink-muted">
              Total <span className="font-medium text-ink">{money(total)}</span>
            </span>
          </div>

          {rows.length > 0 && (
            <div className="mt-3 grid grid-cols-[minmax(150px,1fr)_90px_minmax(90px,1fr)_minmax(150px,1fr)_minmax(150px,1fr)_28px] gap-2 text-xs text-ink-muted">
              <span>Expected</span>
              <span>Amount €</span>
              <span>Invoice</span>
              <span>Invoiced</span>
              <span>Settled</span>
              <span />
            </div>
          )}

          <div className="mt-1 space-y-2">
            {rows.map((r) => (
              <div
                key={r.key}
                className="grid grid-cols-[minmax(150px,1fr)_90px_minmax(90px,1fr)_minmax(150px,1fr)_minmax(150px,1fr)_28px] gap-2 items-center"
              >
                <DateField
                  label=""
                  name={`expected_date_${r.key}`}
                  defaultValue={r.expected_date}
                  onValueChange={(v) => patchRow(r.key, { expected_date: v })}
                />
                <input
                  value={r.amount}
                  onChange={(e) => patchRow(r.key, { amount: e.target.value })}
                  placeholder="0,00"
                  inputMode="decimal"
                  className={`${INPUT_SM} text-right`}
                />
                <input
                  value={r.invoice_ref}
                  onChange={(e) => patchRow(r.key, { invoice_ref: e.target.value })}
                  placeholder="invoice #"
                  className={INPUT_SM}
                />
                <DateField
                  label=""
                  name={`invoiced_at_${r.key}`}
                  defaultValue={r.invoiced_at}
                  onValueChange={(v) => patchRow(r.key, { invoiced_at: v })}
                />
                <DateField
                  label=""
                  name={`settled_at_${r.key}`}
                  defaultValue={r.settled_at}
                  onValueChange={(v) => patchRow(r.key, { settled_at: v })}
                />
                <button
                  type="button"
                  aria-label="Remove payment"
                  onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
                  className="h-7 w-7 inline-flex items-center justify-center rounded-md text-ink-muted hover:text-ink hover:bg-surface-sunken"
                >
                  <X size={15} strokeWidth={1.75} />
                </button>
              </div>
            ))}
          </div>

          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="mt-3"
            leading={<Plus size={14} strokeWidth={2} />}
            onClick={() =>
              setRows((rs) => [
                ...rs,
                {
                  key: rowSeq++,
                  expected_date: '',
                  amount: '',
                  invoice_ref: '',
                  invoiced_at: '',
                  settled_at: '',
                },
              ])
            }
          >
            Add payment
          </Button>
        </div>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
      </form>
    </Dialog>
  );
}
