'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { money } from '@/lib/money';
import { saveCommitment, deleteCommitment, type LinePayload } from './actions';
import { personName, teamName, type Commitment, type Pickers } from './types';

const STAGES = ['lead', 'proposal', 'committed', 'done', 'cancelled'] as const;
type Stage = (typeof STAGES)[number];

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
  pickers,
  onClose,
}: {
  commitment: Commitment | null; // null = new
  pickers: Pickers;
  onClose: () => void;
}) {
  const router = useRouter();

  const [direction, setDirection] = useState<'in' | 'out'>(commitment?.direction ?? 'in');
  const [label, setLabel] = useState(commitment?.label ?? '');
  const [orgId, setOrgId] = useState(commitment?.organisation_id ?? '');
  const [personId, setPersonId] = useState(commitment?.person_id ?? '');
  const [teamId, setTeamId] = useState(commitment?.team_id ?? '');
  const [projectId, setProjectId] = useState(commitment?.project_id ?? '');
  const [offeringId, setOfferingId] = useState(commitment?.offering_id ?? '');
  const [ownerId, setOwnerId] = useState(commitment?.owner_user_id ?? '');
  const [stage, setStage] = useState<Stage>(
    (STAGES as readonly string[]).includes(commitment?.stage ?? '')
      ? (commitment!.stage as Stage)
      : 'lead',
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

  // committed/done implies certainty — the API enforces 100 too.
  const probabilityLocked = stage === 'committed' || stage === 'done';

  const total = rows.reduce((acc, r) => acc + (toCents(r.amount) ?? 0), 0);

  const teamProjects = teamId ? pickers.projects.filter((p) => p.team_id === teamId) : [];
  const otherProjects = teamId
    ? pickers.projects.filter((p) => p.team_id !== teamId)
    : pickers.projects;

  function patchRow(key: number, patch: Partial<Row>) {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
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
        stage,
        probability: probabilityLocked ? 100 : probability,
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
      title={commitment ? 'Edit opportunity' : 'New opportunity'}
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
        <div className="grid grid-cols-[1fr_170px] gap-4">
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
            <select
              value={direction}
              onChange={(e) => setDirection(e.target.value as 'in' | 'out')}
              className={INPUT}
            >
              <option value="in">Income</option>
              <option value="out">Outgoing</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Organisation</label>
            <select
              value={orgId}
              onChange={(e) => {
                setOrgId(e.target.value);
                if (e.target.value) setPersonId('');
              }}
              className={INPUT}
            >
              <option value="">No counterparty yet</option>
              {pickers.orgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              Person <span className="font-normal text-ink-muted">(or)</span>
            </label>
            <select
              value={personId}
              onChange={(e) => {
                setPersonId(e.target.value);
                if (e.target.value) setOrgId('');
              }}
              className={INPUT}
            >
              <option value="">No counterparty yet</option>
              {pickers.persons.map((p) => (
                <option key={p.id} value={p.id}>
                  {personName(p)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Team</label>
            <select value={teamId} onChange={(e) => setTeamId(e.target.value)} className={INPUT}>
              <option value="">—</option>
              {pickers.teams.map((t) => (
                <option key={t.id} value={t.team_id}>
                  {teamName(t.team)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Project</label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
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
              onChange={(e) => setOfferingId(e.target.value)}
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
          <div>
            <label className="block text-sm font-medium mb-1">Stage</label>
            <select
              value={stage}
              onChange={(e) => setStage(e.target.value as Stage)}
              className={`${INPUT} capitalize`}
            >
              {STAGES.map((s) => (
                <option key={s} value={s}>
                  {s}
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
            <div className="mt-3 grid grid-cols-[130px_110px_1fr_130px_130px_28px] gap-2 text-xs text-ink-muted">
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
                className="grid grid-cols-[130px_110px_1fr_130px_130px_28px] gap-2 items-center"
              >
                <input
                  type="date"
                  value={r.expected_date}
                  onChange={(e) => patchRow(r.key, { expected_date: e.target.value })}
                  className={INPUT_SM}
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
                <input
                  type="date"
                  value={r.invoiced_at}
                  onChange={(e) => patchRow(r.key, { invoiced_at: e.target.value })}
                  className={INPUT_SM}
                />
                <input
                  type="date"
                  value={r.settled_at}
                  onChange={(e) => patchRow(r.key, { settled_at: e.target.value })}
                  className={INPUT_SM}
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
