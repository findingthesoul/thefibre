'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowDownLeft, ArrowUpRight, ChevronDown, ChevronRight, Plus, X } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { DateField } from '@/components/ui/date-field';
import { money } from '@/lib/money';
import {
  saveCommitment,
  deleteCommitment,
  createOrganisation,
  createPerson,
  getOrgMembers,
  linkPersonToOrg,
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
function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

type RepeatCadence = 'weekly' | 'fortnightly' | 'monthly' | 'quarterly' | 'yearly';

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
  // Company-aware person picking (Sjoerd 2026-07-08): members of the selected
  // organisation load on selection; picking a non-member asks BEFORE the
  // connection is made. null = no org selected / not loaded yet.
  const [orgMembers, setOrgMembers] = useState<PersonOption[] | null>(null);
  const [membersLoading, setMembersLoading] = useState(false);
  // Ref mirror of the member ids — the combobox's onSelect fires in the same
  // tick as a just-completed create+link, before state has re-rendered.
  const memberIdsRef = useRef<Set<string> | null>(null);
  const [linkPrompt, setLinkPrompt] = useState<string | null>(null); // personId awaiting confirm
  const [linkBusy, setLinkBusy] = useState(false);
  // "linked to <company>" — keyed by person so selecting that same person
  // (the combobox does onCreate → onSelect) doesn't wipe it.
  const [linkNote, setLinkNote] = useState<{ personId: string; text: string } | null>(null);
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
  // Recurring is a characteristic, not a separate thing (Sjoerd 2026-07-08).
  // '' = doesn't repeat. When repeating, occurrences come from the deal size
  // (quantity × unit price) — the lines editor is hidden and lines untouched.
  const [repeatCadence, setRepeatCadence] = useState<RepeatCadence | ''>(
    commitment?.repeat_cadence ?? '',
  );
  const [repeatStartsOn, setRepeatStartsOn] = useState(
    commitment?.repeat_starts_on ?? todayIso(),
  );
  const [repeatUntil, setRepeatUntil] = useState(commitment?.repeat_until ?? '');
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
  // Progressive disclosure: Label / Team / Project / Offering / Owner /
  // Notes fold behind "More options" — collapsed for new items, open when
  // editing one that uses any of them (label always does on saved items).
  const [moreOpen, setMoreOpen] = useState<boolean>(
    !!commitment &&
      Boolean(
        commitment.label ||
          commitment.team_id ||
          commitment.project_id ||
          commitment.offering_id ||
          commitment.owner_user_id ||
          commitment.notes,
      ),
  );

  const repeating = repeatCadence !== '';

  // Fetch the selected company's people whenever the organisation changes.
  useEffect(() => {
    setLinkPrompt(null);
    setLinkNote(null);
    if (!orgId) {
      setOrgMembers(null);
      memberIdsRef.current = null;
      setMembersLoading(false);
      return;
    }
    let cancelled = false;
    setMembersLoading(true);
    void getOrgMembers(orgId).then((res) => {
      if (cancelled) return;
      setMembersLoading(false);
      const members = res.data ?? [];
      setOrgMembers(members);
      memberIdsRef.current = new Set(members.map((p) => p.id));
    });
    return () => {
      cancelled = true;
    };
  }, [orgId]);

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
  const selectedOrgName = orgs.find((o) => o.id === orgId)?.name ?? 'this company';
  // Company people first (sublabel "at <company>"), then everyone else with
  // their email — one flat list, two groups.
  const personOptions =
    orgId && orgMembers
      ? [
          ...orgMembers.map((p) => ({
            id: p.id,
            label: personName(p),
            sublabel: `at ${selectedOrgName}`,
          })),
          ...persons
            .filter((p) => !orgMembers.some((m) => m.id === p.id))
            .map((p) => ({ id: p.id, label: personName(p), sublabel: p.email })),
        ]
      : persons.map((p) => ({ id: p.id, label: personName(p), sublabel: p.email }));

  const pendingPerson = linkPrompt
    ? [...(orgMembers ?? []), ...persons].find((p) => p.id === linkPrompt) ?? null
    : null;

  // Selecting a person who is NOT a member of the selected company: check
  // before making the connection (Sjoerd: "the system should ask if this
  // connection is checked before made").
  function handleSelectPerson(id: string) {
    setLinkNote((n) => (n && n.personId === id ? n : null));
    if (!id) {
      setLinkPrompt(null);
      setPersonId('');
      return;
    }
    if (orgId && memberIdsRef.current && !memberIdsRef.current.has(id)) {
      setLinkPrompt(id);
      return; // selection deferred to the confirm below
    }
    setLinkPrompt(null);
    setPersonId(id);
  }

  async function confirmLink() {
    if (!linkPrompt || !orgId) return;
    const id = linkPrompt;
    setLinkBusy(true);
    setError(null);
    const res = await linkPersonToOrg(orgId, id);
    setLinkBusy(false);
    if (res.error) {
      setError(`Could not link the person to ${selectedOrgName}: ${res.error}`);
      return;
    }
    memberIdsRef.current?.add(id);
    const p = persons.find((x) => x.id === id);
    if (p) setOrgMembers((ms) => (ms ? [...ms, p] : ms));
    setLinkNote({ personId: id, text: `linked to ${selectedOrgName}` });
    setLinkPrompt(null);
    setPersonId(id);
  }

  function selectWithoutLinking() {
    if (!linkPrompt) return;
    setPersonId(linkPrompt);
    setLinkPrompt(null);
  }

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
    // Creating a person WHILE a company is selected: the intent is explicit —
    // link them straight away, no confirm.
    if (orgId) {
      const linked = await linkPersonToOrg(orgId, created.id);
      if (linked.error) {
        setLinkNote({
          personId: created.id,
          text: `Created, but could not link to ${selectedOrgName}: ${linked.error}`,
        });
      } else {
        memberIdsRef.current?.add(created.id);
        setOrgMembers((ms) => (ms ? [...ms, created] : ms));
        setLinkNote({ personId: created.id, text: `linked to ${selectedOrgName}` });
      }
    }
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
      setMoreOpen(true); // the field lives under More options — reveal it
      return;
    }

    // Repeating items derive occurrences from the deal size — no deal, no
    // occurrences, nothing to project. Block the save instead of saving air.
    const qNum = parseFloat(quantity.replace(',', '.'));
    const unitCents = toCents(unitAmount);
    const dealCents =
      Number.isFinite(qNum) && qNum > 0 && unitCents != null ? Math.round(qNum * unitCents) : 0;
    if (repeating && dealCents <= 0) {
      setError('A repeating item needs a positive deal size (quantity × unit price).');
      return;
    }

    // Build line payloads; blank rows are dropped, half-filled rows block save.
    const original = new Map((commitment?.lines ?? []).map((l) => [l.id, l]));
    const lines: LinePayload[] = [];
    if (repeating) {
      // Occurrences come from the deal size; the projection ignores lines on
      // repeating commitments. Pass the ORIGINAL lines through untouched so
      // switching a one-off to repeating deletes nothing.
      for (const l of commitment?.lines ?? []) {
        lines.push({
          id: l.id,
          dirty: false,
          expected_date: l.expected_date,
          amount_cents: l.amount_cents,
          invoice_ref: l.invoice_ref,
          invoiced_at: l.invoiced_at,
          settled_at: l.settled_at,
        });
      }
    } else {
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
        quantity: Number.isFinite(qNum) && qNum > 0 ? qNum : 1,
        unit_amount_cents: unitCents,
        repeat_cadence: repeating ? repeatCadence : null,
        repeat_starts_on: repeating ? repeatStartsOn || todayIso() : null,
        repeat_until: repeating ? repeatUntil || null : null,
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
        // An opportunity is just income (Sjoerd 2026-07-08) — no third noun.
        direction === 'out'
          ? commitment
            ? 'Edit cost'
            : 'New cost'
          : commitment
            ? 'Edit income'
            : 'New income'
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
        {/* Direction first — it decides everything else. The rarely touched
            fields fold behind More options below (progressive disclosure,
            Sjoerd 2026-07-08: "this popup is very unclear"). */}
        <div className="max-w-[300px]">
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

        {/* Organisation + person are NOT exclusive (Sjoerd 2026-07-08): a
            deal has a company AND a contact person at it. Once a company is
            selected its people surface first in the person picker. */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Organisation</label>
            <Combobox
              value={orgId}
              options={orgOptions}
              placeholder="No counterparty yet"
              emptyLabel="No counterparty yet"
              onSelect={setOrgId}
              onCreate={handleCreateOrg}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Person</label>
            <Combobox
              value={personId}
              options={personOptions}
              placeholder="No counterparty yet"
              emptyLabel="No counterparty yet"
              onSelect={handleSelectPerson}
              onCreate={handleCreatePerson}
              createExtraField={{ label: 'Email', placeholder: 'name@example.com' }}
            />
            {membersLoading && (
              <p className="mt-1 text-xs text-ink-muted">Loading company people…</p>
            )}
            {linkNote && <p className="mt-1 text-xs text-ink-muted">{linkNote.text}</p>}
            {linkPrompt && (
              <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                <p>
                  <span className="font-medium">
                    {pendingPerson ? personName(pendingPerson) : 'This person'}
                  </span>{' '}
                  isn&apos;t linked to <span className="font-medium">{selectedOrgName}</span>{' '}
                  yet. Link them?
                </p>
                <div className="mt-1.5 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void confirmLink()}
                    disabled={linkBusy}
                    className="rounded-md bg-ink px-2 py-1 text-xs font-medium text-ink-inverse disabled:opacity-60"
                  >
                    {linkBusy ? 'Linking…' : 'Link & select'}
                  </button>
                  <button
                    type="button"
                    onClick={selectWithoutLinking}
                    disabled={linkBusy}
                    className="rounded-md px-2 py-1 text-xs text-amber-800 underline underline-offset-2 hover:text-amber-900"
                  >
                    Select without linking
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Deal size — quantity × unit price (e.g. 16 × product X @ €1.350). */}
        <div className="border-t border-line pt-4 grid grid-cols-3 gap-4 items-end">
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
                  {!repeating && (
                    <button
                      type="button"
                      onClick={() =>
                        setRows((rs) => [
                          ...rs,
                          {
                            key: rowSeq++,
                            expected_date: todayIso(),
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
                  )}
                </div>
              );
            })()}
          </div>
        </div>

        {/* Repeats — recurring is a characteristic of the item, not a
            separate thing. Occurrences come from the deal size above. */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Repeats</label>
            <select
              value={repeatCadence}
              onChange={(e) => setRepeatCadence(e.target.value as RepeatCadence | '')}
              className={INPUT}
            >
              <option value="">Doesn&apos;t repeat</option>
              <option value="weekly">Weekly</option>
              <option value="fortnightly">Fortnightly</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="yearly">Yearly</option>
            </select>
            {repeating && (
              <p className="mt-1 text-xs text-ink-muted">
                Repeats use the deal size (quantity × unit price) per occurrence.
              </p>
            )}
          </div>
          {repeating && (
            <>
              <DateField
                label="First on"
                name="repeat_starts_on"
                defaultValue={repeatStartsOn}
                onValueChange={setRepeatStartsOn}
              />
              <DateField
                label="Until (optional)"
                name="repeat_until"
                defaultValue={repeatUntil}
                onValueChange={setRepeatUntil}
              />
            </>
          )}
        </div>

        {direction === 'in' ? (
          <div className="grid grid-cols-3 gap-4">
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
          </div>
        ) : (
          <p className="text-xs text-ink-muted">
            Costs count in full — no pipeline stage. For a repeating cost, set Repeats above.
          </p>
        )}

        {/* ---- Lines editor ------------------------------------------------
            Hidden while repeating: occurrences come from the deal size, and
            the existing lines are passed through untouched on save. */}
        {!repeating && (
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
        )}

        {/* ---- More options -------------------------------------------------
            Label (it auto-prefills from project/offering), Team, Project,
            Offering, Owner and Notes — folded by default for new items. */}
        <div className="border-t border-line pt-3">
          <button
            type="button"
            onClick={() => setMoreOpen((v) => !v)}
            aria-expanded={moreOpen}
            className="flex items-center gap-1.5 text-sm font-medium text-ink-subtle hover:text-ink"
          >
            {moreOpen ? (
              <ChevronDown size={14} strokeWidth={2} />
            ) : (
              <ChevronRight size={14} strokeWidth={2} />
            )}
            More options
          </button>
          {moreOpen && (
            <div className="mt-3 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Label</label>
                <input
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="e.g. Website rebuild — phase 2"
                  className={INPUT}
                />
                <p className="mt-1 text-xs text-ink-muted">
                  Prefills from the project or offering when left empty.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Team</label>
                  <select
                    value={teamId}
                    onChange={(e) => setTeamId(e.target.value)}
                    className={INPUT}
                  >
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
                        setUnitAmount(
                          (off.default_amount_cents / 100).toFixed(2).replace('.', ','),
                        );
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
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Owner</label>
                  <select
                    value={ownerId}
                    onChange={(e) => setOwnerId(e.target.value)}
                    className={INPUT}
                  >
                    <option value="">{commitment ? 'Unchanged' : 'Me'}</option>
                    {pickers.members.map((m) => (
                      <option key={m.user_id} value={m.user_id}>
                        {m.full_name ?? m.email ?? m.user_id}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium mb-1">Notes</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    placeholder="Optional"
                    className={INPUT}
                  />
                </div>
              </div>
            </div>
          )}
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
