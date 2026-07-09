'use client';

// The income/cost popup, restyled to read like a clean INVOICE document
// (Sjoerd 2026-07-09: "more compact... in columns... rows full bleed for the
// no... almost like an invoice", refined same day, items 5–12): contact
// header (org + person side by side, the addressee) with a compact
// Income|Cost ICON switch at the end of the band → a small "More" chevron
// disclosure directly under the band (Project · Owner · Team + the optional
// offer/quotation link) → ONE title row (Name · narrow Expected date ·
// Stage+%) → OFFERING ROWS full bleed (edge-to-edge table, hairline rows,
// "+ add offering" footer row) → totals bottom-right (weighted / full / VAT
// / TOTAL incl VAT bold) → the invoice section at the bottom (full-width
// "Turn offering into an invoice"; once invoiced: read-only Invoice date +
// editable Expected + the Invoice {no} badge) → Notes last. Every control
// (except Notes) sits at the same h-9 rhythm. The payments editor + the
// legacy Offering select stay behind More options. Offering rows persist via
// the items endpoints; commitments without items keep the legacy single
// quantity/unit fields (backward compat). The invoice transfer opens the
// nested confirm popup (org-dialog stacking rules: later sibling paints on
// top, the outer dialog's onClose is guarded while a nested one is open).
// Validation errors stay inline; SERVER errors pop as toasts.

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Plus,
  X,
} from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { DateField } from '@/components/ui/date-field';
import { money } from '@/lib/money';
import {
  saveCommitment,
  deleteCommitment,
  invoiceCommitment,
  createOrganisation,
  createPerson,
  getOrgMembers,
  linkPersonToOrg,
  type ItemPayload,
  type LinePayload,
} from './actions';
import { Combobox, type ComboCreateResult } from './combobox';
import { toastError } from './toast';
import {
  personName,
  teamName,
  type CashflowScope,
  type Commitment,
  type OrgOption,
  type PersonOption,
  type Pickers,
} from './types';

// EVERY control (input, select, combobox, date trigger) sits at the same
// h-9 rhythm — the Notes textarea is the one exception (spec item 5).
const INPUT =
  'h-9 w-full rounded-md border border-line bg-surface-raised px-3 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300';
const INPUT_SM =
  'h-9 w-full rounded-md border border-line bg-surface-raised px-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300';
const TEXTAREA =
  'w-full rounded-md border border-line bg-surface-raised px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300';
// Invoice-document label rhythm — small, quiet, uppercase.
const LABEL = 'block text-xs font-medium uppercase tracking-wide text-ink-muted mb-1';
// The dialog body (size="xl") pads px-7 py-6 — full-bleed rows counter it.
const BLEED = '-mx-7';

// DateField doesn't take a className and its shared trigger is h-11 — wrap
// it so the trigger (the direct-child button of DateField's root; NOT the
// calendar popover's buttons, which sit a level deeper) matches the dialog's
// h-9 control rhythm, and restyle the label to the invoice LABEL voice.
function CompactDateField({
  className = '',
  label,
  ...props
}: Omit<React.ComponentProps<typeof DateField>, 'label'> & {
  className?: string;
  label?: React.ReactNode;
}) {
  return (
    <div
      className={`[&>div>button]:!mt-0 [&>div>button]:!h-9 [&>div>button]:!px-3 [&>div>button]:!text-sm [&>div>button]:overflow-hidden [&>div>button>span:first-child]:truncate ${className}`}
    >
      <DateField label={label ? <span className={LABEL}>{label}</span> : ''} {...props} />
    </div>
  );
}

// "Wed 8 Jul 2026" — the read-only Invoice date display (matches DateField).
function fmtDateDisplay(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

// Euros displayed ↔ integer cents stored. Comma decimals accepted.
function toCents(s: string): number | null {
  const n = parseFloat(s.trim().replace(',', '.'));
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}
function fromCents(c: number): string {
  return (c / 100).toFixed(2);
}
function centsToInput(c: number): string {
  return (c / 100).toFixed(2).replace('.', ',');
}
function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

type RepeatCadence = 'weekly' | 'fortnightly' | 'monthly' | 'quarterly' | 'yearly';
const CADENCES: { value: RepeatCadence; label: string }[] = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'fortnightly', label: 'Fortnightly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly', label: 'Yearly' },
];

type Row = {
  key: number;
  id?: string;
  expected_date: string;
  amount: string;
  invoice_ref: string;
  invoiced_at: string;
  settled_at: string;
};

// An offering row — offeringId '' means a free-text name.
type ItemRow = {
  key: number;
  id?: string;
  offeringId: string;
  name: string;
  quantity: string;
  unitAmount: string;
  repeat: RepeatCadence | '';
};

let rowSeq = 0;

function itemRowFull(r: ItemRow): number | null {
  const q = parseFloat(r.quantity.trim().replace(',', '.'));
  const unit = toCents(r.unitAmount);
  return Number.isFinite(q) && q > 0 && unit != null ? Math.round(q * unit) : null;
}

export function OpportunityDialog({
  commitment,
  initialDirection,
  initialOrgId,
  initialPersonId,
  pickers,
  currentUserId,
  scope,
  scopeTeamId,
  onClose,
}: {
  commitment: Commitment | null; // null = new
  initialDirection?: 'in' | 'out';
  // Counterparty preselect for NEW items — the org popup's + Add passes the
  // org/person it was opened for ("adding one, opens a popup to add one").
  initialOrgId?: string;
  initialPersonId?: string;
  pickers: Pickers;
  currentUserId: string | null;
  // The active cashflow tab — tabs are SEPARATE cashflows, and a NEW item is
  // stamped into the one it's created in (Me → personal, team tab → that
  // team, workspace → neither). On EDIT the stamp never changes.
  scope: CashflowScope;
  scopeTeamId: string | null;
  onClose: () => void;
}) {
  const router = useRouter();

  const sortedStages = [...pickers.stages].sort((a, b) => a.sort_order - b.sort_order);

  const [direction, setDirection] = useState<'in' | 'out'>(
    commitment?.direction ?? initialDirection ?? 'in',
  );
  const [label, setLabel] = useState(commitment?.label ?? '');
  const [orgId, setOrgId] = useState(commitment?.organisation_id ?? initialOrgId ?? '');
  const [personId, setPersonId] = useState(commitment?.person_id ?? initialPersonId ?? '');
  // Local copies so an inline "Create '<query>'" shows up immediately.
  const [orgs, setOrgs] = useState<OrgOption[]>(pickers.orgs);
  const [persons, setPersons] = useState<PersonOption[]>(pickers.persons);
  // Company-aware person picking: members of the selected organisation load
  // on selection; the picker then lists ONLY them (Sjoerd 2026-07-09) — the
  // "Add person…" popup covers everyone else. null = no org / not loaded.
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
  // Creating FROM a team tab stamps the item into that team's cashflow —
  // the Team select is locked to it (a hint says so). Only on CREATE; edits
  // never move an item between cashflows.
  const teamLocked = !commitment && scope === 'team' && !!scopeTeamId;
  // Team auto-derives for NEW items: the tab's team when creating from a
  // team tab (locked), else the single involved team when there is exactly
  // one (a picked project's team overrides below). Still editable.
  const [teamId, setTeamId] = useState(
    commitment
      ? commitment.team_id ?? ''
      : teamLocked
        ? scopeTeamId!
        : pickers.teams.length === 1
          ? pickers.teams[0].team_id
          : '',
  );
  const [projectId, setProjectId] = useState(commitment?.project_id ?? '');
  const [offeringId, setOfferingId] = useState(commitment?.offering_id ?? '');
  // LEGACY deal size — quantity × unit price. Only shown (and saved from the
  // fields) when the commitment has no offering rows.
  const [quantity, setQuantity] = useState(
    commitment ? String(commitment.quantity ?? 1) : '1',
  );
  const [unitAmount, setUnitAmount] = useState(
    commitment?.unit_amount_cents != null ? centsToInput(commitment.unit_amount_cents) : '',
  );
  // New opportunities default to the signed-in user when they're a member;
  // '' keeps the API default (caller on create / unchanged on edit).
  const [ownerId, setOwnerId] = useState(
    commitment?.owner_user_id ??
      (currentUserId && pickers.members.some((m) => m.user_id === currentUserId)
        ? currentUserId
        : ''),
  );
  // Legacy recurring characteristic (commitment-level). In items mode the
  // rows carry their own Repeat; these fields pass through unchanged.
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
  // Offer / quotation link (spec item 12) — sent as quote_url; older rows
  // won't have the field yet, hence the double fallback.
  const [quoteUrl, setQuoteUrl] = useState(commitment?.quote_url ?? '');
  // VAT tariff — '' = no VAT; otherwise the pct as a string ("21").
  const [vatPct, setVatPct] = useState(
    commitment?.vat_pct != null ? String(Number(commitment.vat_pct)) : '',
  );
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
  // The single Expected date (spec item 4): seeds/updates the FIRST payment
  // line; the full payments editor stays under More options.
  const [expectedDate, setExpectedDate] = useState(() => {
    const sorted = [...(commitment?.lines ?? [])].sort((a, b) =>
      a.expected_date.localeCompare(b.expected_date),
    );
    return sorted[0]?.expected_date ?? todayIso();
  });
  // OFFERING ROWS — the deal. New commitments start with one blank row;
  // existing ones without items stay in legacy mode until a row is added.
  const [itemRows, setItemRows] = useState<ItemRow[]>(() => {
    if (!commitment) {
      return [{ key: rowSeq++, offeringId: '', name: '', quantity: '1', unitAmount: '', repeat: '' }];
    }
    return [...(commitment.items ?? [])]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((i) => ({
        key: rowSeq++,
        id: i.id,
        offeringId: i.offering_id ?? '',
        name: i.name,
        quantity: String(Number(i.quantity)),
        unitAmount: centsToInput(i.unit_amount_cents),
        repeat: i.repeat_cadence ?? '',
      }));
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Nested popups (org-dialog stacking rules apply).
  const [addPersonOpen, setAddPersonOpen] = useState(false);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  // Set by a successful transfer so the badge shows without a prop refresh.
  const [invoicedNo, setInvoicedNo] = useState<string | null>(commitment?.invoice_no ?? null);
  // Progressive disclosure ×2 (spec item 6): "More" directly under the
  // contact band holds Project/Owner/Team + the offer link; "More options"
  // further down keeps the payments editor (+ legacy Offering). Each opens
  // when the saved item visibly uses its hidden fields.
  const [detailsOpen, setDetailsOpen] = useState<boolean>(
    !!commitment && Boolean(commitment.project_id || commitment.quote_url),
  );
  const [moreOpen, setMoreOpen] = useState<boolean>(
    !!commitment &&
      Boolean(
        (commitment.lines ?? []).length > 1 ||
          ((commitment.items ?? []).length === 0 && commitment.offering_id),
      ),
  );

  const itemsMode = itemRows.length > 0;
  // Legacy recurring only — items mode hides the commitment-level Repeats
  // (each row has its own) and passes the stored values through on save.
  const repeating = !itemsMode && repeatCadence !== '';
  const nestedOpen = addPersonOpen || invoiceOpen;

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

  // The probability every weighted amount uses: costs count in full.
  const effProb = direction === 'out' ? 100 : probabilityLocked ? 100 : probability;

  const orgOptions = orgs.map((o) => ({ id: o.id, label: o.name }));
  const selectedOrgName = orgs.find((o) => o.id === orgId)?.name ?? 'this company';
  // With a company selected: ONLY its people (Sjoerd 2026-07-09) — plus the
  // already-selected person if they're not linked, so the input keeps their
  // name. "Add person…" (below) covers existing contacts + create-new.
  const strictMode = Boolean(orgId && orgMembers);
  const personOptions = strictMode
    ? [
        ...orgMembers!.map((p) => ({
          id: p.id,
          label: personName(p),
          sublabel: `at ${selectedOrgName}`,
        })),
        ...(personId && !orgMembers!.some((m) => m.id === personId)
          ? persons
              .filter((p) => p.id === personId)
              .map((p) => ({ id: p.id, label: personName(p), sublabel: 'not linked' }))
          : []),
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
    const res = await linkPersonToOrg(orgId, id);
    setLinkBusy(false);
    if (res.error) {
      // Server failure → toast (validation stays inline).
      toastError(`Could not link the person to ${selectedOrgName}: ${res.error}`);
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

  // ---- totals ---------------------------------------------------------------
  const legacyFull = (() => {
    const q = parseFloat(quantity.replace(',', '.'));
    const unit = toCents(unitAmount);
    return Number.isFinite(q) && q > 0 && unit != null ? Math.round(q * unit) : 0;
  })();
  const fullTotal = itemsMode
    ? itemRows.reduce((a, r) => a + (itemRowFull(r) ?? 0), 0)
    : legacyFull;
  const weightedTotal = itemsMode
    ? itemRows.reduce((a, r) => {
        const full = itemRowFull(r);
        return a + (full != null ? Math.round((full * effProb) / 100) : 0);
      }, 0)
    : Math.round((legacyFull * effProb) / 100);
  const vatNumber = vatPct === '' ? null : Number(vatPct);
  const totalInclVat =
    vatNumber != null ? Math.round(fullTotal * (1 + vatNumber / 100)) : fullTotal;
  // Editing a commitment whose stored VAT no longer matches a tariff: keep
  // it selectable rather than silently clearing it.
  const vatIsCustom =
    vatPct !== '' && !pickers.vatTariffs.some((t) => String(t.pct) === vatPct);

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

  // A team's display name — involved list first, then all workspace teams.
  function teamLabelFor(id: string): string {
    const inv = pickers.teams.find((t) => t.team_id === id);
    if (inv) return teamName(inv.team);
    return pickers.allTeams.find((t) => t.id === id)?.name ?? 'Team';
  }

  // The cashflow this item BELONGS to — the stored stamp on edit, the active
  // tab on create. Shown as a muted header chip when NOT workspace.
  const cashflowChip = commitment
    ? commitment.personal
      ? 'Personal cashflow'
      : commitment.team_id
        ? `${teamLabelFor(commitment.team_id)} cashflow`
        : null
    : scope === 'me'
      ? 'Personal cashflow'
      : scope === 'team' && scopeTeamId
        ? `${teamLabelFor(scopeTeamId)} cashflow`
        : null;

  const teamProjects = teamId ? pickers.projects.filter((p) => p.team_id === teamId) : [];
  const otherProjects = teamId
    ? pickers.projects.filter((p) => p.team_id !== teamId)
    : pickers.projects;

  function patchRow(key: number, patch: Partial<Row>) {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }
  function patchItem(key: number, patch: Partial<ItemRow>) {
    setItemRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }
  function addItemRow(seed?: Partial<ItemRow>) {
    setItemRows((rs) => [
      ...rs,
      { key: rowSeq++, offeringId: '', name: '', quantity: '1', unitAmount: '', repeat: '', ...seed },
    ]);
  }

  // The Expected date drives the FIRST payment line (spec item 4).
  function onExpectedDate(v: string) {
    setExpectedDate(v);
    setRows((rs) => (rs.length > 0 ? rs.map((r, i) => (i === 0 ? { ...r, expected_date: v } : r)) : rs));
  }

  // "Label of an opportunity is: project/offering" — picking one prefills an
  // empty label with its name (still freely editable afterwards).
  function prefillLabel(name: string | undefined) {
    if (name && !label.trim()) setLabel(name);
  }

  async function submit(e?: React.FormEvent<HTMLFormElement>) {
    e?.preventDefault();
    if (!label.trim()) {
      setError('Name is required.');
      return;
    }

    // ---- offering rows → item payloads ------------------------------------
    const origItems = new Map((commitment?.items ?? []).map((i) => [i.id, i]));
    const items: ItemPayload[] = [];
    if (itemsMode) {
      let idx = 0;
      for (const r of itemRows) {
        const blank = !r.name.trim() && !r.unitAmount.trim() && !r.offeringId;
        if (blank) continue;
        const q = parseFloat(r.quantity.trim().replace(',', '.'));
        const unit = toCents(r.unitAmount);
        if (!r.name.trim() || unit == null || !Number.isFinite(q) || q <= 0) {
          setError('Each offering row needs a name, a positive quantity and a price.');
          return;
        }
        const payload: ItemPayload = {
          id: r.id,
          offering_id: r.offeringId || null,
          name: r.name.trim(),
          quantity: q,
          unit_amount_cents: unit,
          repeat_cadence: r.repeat || null,
          sort_order: idx++,
        };
        if (r.id) {
          const o = origItems.get(r.id);
          payload.dirty =
            !o ||
            (o.offering_id ?? null) !== payload.offering_id ||
            o.name !== payload.name ||
            Number(o.quantity) !== payload.quantity ||
            o.unit_amount_cents !== payload.unit_amount_cents ||
            (o.repeat_cadence ?? null) !== payload.repeat_cadence ||
            o.sort_order !== payload.sort_order;
        }
        items.push(payload);
      }
    }
    const hasItems = items.length > 0;
    const itemsNet = items.reduce(
      (a, i) => a + Math.round(i.quantity * i.unit_amount_cents),
      0,
    );

    // Legacy repeating items derive occurrences from the deal size — no deal,
    // no occurrences, nothing to project. Block the save instead of saving air.
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
      // The payment is DERIVED, not a separate list (Sjoerd 2026-07-10: "all
      // info is above — I don't need that separate list"). One payment =
      // the deal total (offering rows or quantity × unit) on the Expected
      // date. Invoice/settle state on the existing line is preserved and
      // freezes its amount/date. A pre-existing staged schedule (2+ lines,
      // from before this change) is passed through untouched.
      const originalLines = commitment?.lines ?? [];
      const dealNet = hasItems ? itemsNet : dealCents;
      if (originalLines.length >= 2) {
        for (const l of originalLines) {
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
        const existing = originalLines[0];
        if (existing) {
          const frozen = !!existing.invoiced_at || !!existing.settled_at;
          const amount = frozen ? existing.amount_cents : dealNet > 0 ? dealNet : existing.amount_cents;
          const date = frozen ? existing.expected_date : expectedDate || existing.expected_date;
          lines.push({
            id: existing.id,
            dirty: amount !== existing.amount_cents || date !== existing.expected_date,
            expected_date: date,
            amount_cents: amount,
            invoice_ref: existing.invoice_ref,
            invoiced_at: existing.invoiced_at,
            settled_at: existing.settled_at,
          });
        } else if (dealNet > 0 && expectedDate) {
          lines.push({
            expected_date: expectedDate,
            amount_cents: dealNet,
            invoice_ref: null,
            invoiced_at: null,
            settled_at: null,
          });
        }
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
        // Cashflow stamp — CREATE only: Me tab → personal; team tab → that
        // team, forced; workspace → neither (its team stays hub attribution).
        // On EDIT `personal` is omitted (the API keeps the stored stamp).
        ...(commitment ? {} : { personal: scope === 'me' }),
        team_id: teamLocked ? scopeTeamId : teamId || null,
        project_id: projectId || null,
        offering_id: offeringId || null,
        // Omitted = API defaults to the caller / keeps the current owner.
        ...(ownerId ? { owner_user_id: ownerId } : {}),
        // Items are the deal when present — bridge the legacy fields to the
        // items total so every older surface (table totals, projection)
        // keeps showing the right number.
        quantity: hasItems ? 1 : Number.isFinite(qNum) && qNum > 0 ? qNum : 1,
        unit_amount_cents: hasItems ? itemsNet || null : unitCents,
        // Items mode: commitment-level repeat passes through unchanged (the
        // rows carry their own cadence); legacy mode: from the Repeats select.
        repeat_cadence: itemsMode
          ? commitment?.repeat_cadence ?? null
          : repeating
            ? (repeatCadence as RepeatCadence)
            : null,
        repeat_starts_on: itemsMode
          ? commitment?.repeat_starts_on ?? null
          : repeating
            ? repeatStartsOn || todayIso()
            : null,
        repeat_until: itemsMode
          ? commitment?.repeat_until ?? null
          : repeating
            ? repeatUntil || null
            : null,
        vat_pct: vatNumber,
        // A cost is not an opportunity (Sjoerd 2026-07-08): no pipeline
        // semantics. New costs save as committed money; existing rows keep
        // their stored stage untouched.
        stage: direction === 'out' && !commitment ? 'committed' : stage,
        probability:
          direction === 'out' && !commitment ? 100 : probabilityLocked ? 100 : probability,
        notes: notes.trim() || null,
        quote_url: quoteUrl.trim() || null,
      },
      lines,
      originalLineIds: (commitment?.lines ?? []).map((l) => l.id),
      items,
      originalItemIds: (commitment?.items ?? []).map((i) => i.id),
    });
    if (res.error) {
      // Server/API failure → toast (inline stays for field validation).
      toastError(`Could not save: ${res.error}`);
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
      toastError(`Could not delete: ${res.error}`);
      setBusy(false);
      setConfirmDelete(false);
      return;
    }
    onClose();
    router.refresh();
  }

  // Email the "Create & send" path would use — the saved counterparty person.
  const counterpartyEmail =
    [...(orgMembers ?? []), ...persons].find((p) => p.id === personId)?.email ??
    commitment?.person?.email ??
    null;

  // The full-bleed items table: one column rhythm for header + rows, padded
  // back to the dialog's edge (px-7 matches the xl body padding).
  const itemGrid =
    'grid grid-cols-[minmax(150px,1fr)_52px_88px_104px_minmax(112px,auto)_24px] items-center gap-2 px-7';

  return (
    <>
    <Dialog
      open
      onClose={() => {
        // Escape fires every dialog's listener — while a nested popup is
        // open this outer close is the nested one's to handle (org-dialog
        // stacking rule).
        if (nestedOpen) return;
        onClose();
      }}
      title={
        /* A tiny cue on which cashflow the item belongs to — muted chip in
           the header, only when NOT the workspace cashflow. */
        <span className="flex items-center gap-2">
          {direction === 'out'
            ? commitment
              ? 'Edit cost'
              : 'New cost'
            : commitment
              ? 'Edit income'
              : 'New income'}
          {cashflowChip && (
            <span className="rounded-full bg-surface-sunken px-2 py-px text-xs font-medium text-ink-muted ring-1 ring-line">
              {cashflowChip}
            </span>
          )}
        </span>
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
      <form id="opportunity-form" onSubmit={submit} className="space-y-3">
        {/* HEADER — the invoice addressee: organisation + person side by
            side, prominent; the compact Income|Cost ICON switch closes the
            band row (spec item 7 — the Invoice badge moved to the invoice
            section at the bottom). Full bleed against the dialog's body
            padding, like a letterhead band. Once a company is selected, the
            person picker lists ONLY its people — "Add person…" opens the
            search/create popup (Sjoerd 2026-07-09). */}
        <div className={`${BLEED} -mt-6 border-b border-line bg-surface-sunken/50 px-7 pb-4 pt-5`}>
          <div className="flex items-start gap-4">
            <div className="grid min-w-0 flex-1 grid-cols-2 gap-3">
              <div>
                <label className={LABEL}>Organisation</label>
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
                <label className={LABEL}>Person</label>
                <Combobox
                  value={personId}
                  options={personOptions}
                  placeholder="No counterparty yet"
                  emptyLabel="No counterparty yet"
                  onSelect={handleSelectPerson}
                  onCreate={strictMode ? undefined : handleCreatePerson}
                  createExtraField={
                    strictMode ? undefined : { label: 'Email', placeholder: 'name@example.com' }
                  }
                  actionItem={
                    strictMode
                      ? { label: 'Add person…', onPick: () => setAddPersonOpen(true) }
                      : undefined
                  }
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
            {/* Income|Cost as a two-icon switch — selected state filled;
                mt-5 drops it level with the band's controls (label = text-xs
                line + mb-1); h-8 buttons in a p-0.5 ring = the h-9 rhythm. */}
            <div
              role="group"
              aria-label="Income or cost"
              className="mt-5 flex shrink-0 items-center gap-0.5 rounded-md bg-surface-raised p-0.5 ring-1 ring-line"
            >
              <button
                type="button"
                title="Income"
                aria-label="Income"
                aria-pressed={direction === 'in'}
                onClick={() => setDirection('in')}
                className={`inline-flex h-8 w-8 items-center justify-center rounded transition-colors ${
                  direction === 'in'
                    ? 'bg-emerald-600 text-white'
                    : 'text-ink-subtle hover:bg-surface-sunken hover:text-ink'
                }`}
              >
                <ArrowDownLeft size={15} strokeWidth={2} />
              </button>
              <button
                type="button"
                title="Cost"
                aria-label="Cost"
                aria-pressed={direction === 'out'}
                onClick={() => setDirection('out')}
                className={`inline-flex h-8 w-8 items-center justify-center rounded transition-colors ${
                  direction === 'out'
                    ? 'bg-rose-600 text-white'
                    : 'text-ink-subtle hover:bg-surface-sunken hover:text-ink'
                }`}
              >
                <ArrowUpRight size={15} strokeWidth={2} />
              </button>
            </div>
          </div>
        </div>

        {/* "More" — the small disclosure directly under the contact band
            (spec item 6): Project · Owner · Team, plus the optional offer /
            quotation link (item 12). */}
        <div>
          <button
            type="button"
            onClick={() => setDetailsOpen((v) => !v)}
            aria-expanded={detailsOpen}
            className="flex items-center gap-1 text-xs font-medium text-ink-subtle hover:text-ink"
          >
            {detailsOpen ? (
              <ChevronDown size={13} strokeWidth={2} />
            ) : (
              <ChevronRight size={13} strokeWidth={2} />
            )}
            More
          </button>
          {detailsOpen && (
            <div className="mt-2 space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={LABEL}>Project</label>
                  <select
                    value={projectId}
                    onChange={(e) => {
                      setProjectId(e.target.value);
                      const p = pickers.projects.find((x) => x.id === e.target.value);
                      prefillLabel(p?.name);
                      // The project's team wins the auto-derive (still
                      // editable) — unless the tab's team is locked in.
                      if (p?.team_id && !teamLocked) setTeamId(p.team_id);
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
                  <label className={LABEL}>Owner</label>
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
                <div>
                  <label className={LABEL}>Team</label>
                  {teamLocked ? (
                    /* Creating from a team tab: the item belongs to that
                       team's cashflow — no select, just the fact. */
                    <>
                      <div className="flex h-9 items-center truncate rounded-md border border-line bg-surface-sunken px-3 text-sm text-ink">
                        {teamLabelFor(scopeTeamId!)}
                      </div>
                      <p className="mt-1 text-xs text-ink-muted">
                        This item belongs to the {teamLabelFor(scopeTeamId!)} cashflow.
                      </p>
                    </>
                  ) : (
                    <>
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
                          Showing all teams — pick the involved teams in Settings → Planner to scope this list.
                        </p>
                      )}
                    </>
                  )}
                </div>
              </div>
              <div>
                <div className="mb-1 flex items-center gap-1.5">
                  <span className="text-xs font-medium uppercase tracking-wide text-ink-muted">
                    Offer / quotation link
                  </span>
                  {/^https?:\/\//.test(quoteUrl.trim()) && (
                    <a
                      href={quoteUrl.trim()}
                      target="_blank"
                      rel="noreferrer"
                      title="Open the offer"
                      className="text-ink-subtle hover:text-ink"
                    >
                      <ExternalLink size={12} strokeWidth={2} />
                    </a>
                  )}
                </div>
                <input
                  type="url"
                  value={quoteUrl}
                  onChange={(e) => setQuoteUrl(e.target.value)}
                  placeholder="https://…"
                  className={INPUT}
                />
              </div>
            </div>
          )}
        </div>

        {/* TITLE ROW — ONE line (spec item 8): Name (the flexible share) ·
            a NARROW Expected date · Stage (+ the small %). Once invoiced,
            the Expected date lives in the invoice section at the bottom
            instead; while (legacy) repeating there is no single date. */}
        <div className="flex items-end gap-3">
          <div className="min-w-0 flex-1">
            <label className={LABEL}>Name</label>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Website rebuild — phase 2"
              className={INPUT}
            />
          </div>
          {!repeating && !invoicedNo && (
            <CompactDateField
              className="w-40 shrink-0"
              label="Expected date"
              name="expected_date"
              defaultValue={expectedDate}
              onValueChange={onExpectedDate}
            />
          )}
          {direction === 'in' && (
            <div className="w-52 shrink-0">
              <label className={LABEL}>Stage</label>
              <div className="flex items-center gap-1.5">
                <select
                  value={stage}
                  onChange={(e) => {
                    const key = e.target.value;
                    setStage(key);
                    // Entering a stage takes its default probability (Settings →
                    // Pipeline stages) unless the kind forces 100 — the user can
                    // still edit afterwards. Same rule as the API's PATCH.
                    const next = sortedStages.find((s) => s.key === key);
                    if (
                      next &&
                      next.kind !== 'committed' &&
                      next.kind !== 'won' &&
                      next.default_probability != null
                    ) {
                      setProbability(next.default_probability);
                    }
                  }}
                  className={`${INPUT} min-w-0 flex-1`}
                >
                  {stageOptions.map((s) => (
                    <option key={s.id} value={s.key}>
                      {s.label}
                    </option>
                  ))}
                </select>
                {/* Probability — inline small, behind the stage. */}
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={probabilityLocked ? 100 : probability}
                  disabled={probabilityLocked}
                  aria-label="Probability %"
                  title={probabilityLocked ? 'Committed money counts in full' : 'Probability %'}
                  onChange={(e) => {
                    const n = parseInt(e.target.value, 10);
                    setProbability(Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0);
                  }}
                  className="h-9 w-14 shrink-0 rounded-md border border-line bg-surface-raised px-1.5 text-right text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-neutral-300 disabled:opacity-60"
                />
                <span className="shrink-0 text-xs text-ink-muted">%</span>
              </div>
            </div>
          )}
        </div>

        {/* LEGACY META ROW — the commitment-level Repeats (+ First on /
            Until) only exists for commitments without offering rows; item
            rows carry their own cadence. */}
        {!itemsMode && (
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={LABEL}>Repeats</label>
              <select
                value={repeatCadence}
                onChange={(e) => setRepeatCadence(e.target.value as RepeatCadence | '')}
                className={INPUT}
              >
                <option value="">Doesn&apos;t repeat</option>
                {CADENCES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            {repeating && (
              <>
                <CompactDateField
                  label="First on"
                  name="repeat_starts_on"
                  defaultValue={repeatStartsOn}
                  onValueChange={setRepeatStartsOn}
                />
                <CompactDateField
                  label="Until (optional)"
                  name="repeat_until"
                  defaultValue={repeatUntil}
                  onValueChange={setRepeatUntil}
                />
              </>
            )}
          </div>
        )}
        {direction === 'out' && (
          <p className="text-[11px] text-ink-muted">
            Costs count in full — no pipeline stage.
            {!itemsMode && ' For a repeating cost, set Repeats above.'}
          </p>
        )}

        {/* OFFERING ROWS — THE deal, as the invoice's item table: full bleed
            edge-to-edge, hairline-separated rows, right-aligned tabular
            numbers, "+ add offering" as the table's footer row. Legacy
            commitments without rows keep the single quantity/unit fields
            until a row is added. */}
        {itemsMode ? (
          <div className={`${BLEED} border-y border-line`}>
            <div className="divide-y divide-line/60">
              <div
                className={`${itemGrid} bg-surface-sunken/50 py-1.5 text-[11px] font-medium uppercase tracking-wide text-ink-muted`}
              >
                <span>Offering</span>
                <span className="text-right">Qty</span>
                <span className="text-right">Price €</span>
                <span>Repeats</span>
                <span className="text-right">Amount</span>
                <span />
              </div>
              {itemRows.map((r) => {
                const full = itemRowFull(r);
                const weighted = full != null ? Math.round((full * effProb) / 100) : null;
                return (
                  <div key={r.key} className={`${itemGrid} py-1.5`}>
                    <Combobox
                      value={r.offeringId}
                      options={pickers.offerings.map((o) => ({ id: o.id, label: o.name }))}
                      placeholder="Offering or description"
                      freeLabel={r.name}
                      small
                      onSelect={(id) => {
                        const off = pickers.offerings.find((o) => o.id === id);
                        patchItem(r.key, {
                          offeringId: id,
                          ...(off
                            ? {
                                name: off.name,
                                ...(off.default_amount_cents != null
                                  ? { unitAmount: centsToInput(off.default_amount_cents) }
                                  : {}),
                              }
                            : {}),
                        });
                        if (off) prefillLabel(off.name);
                      }}
                      onFreeText={(text) => {
                        // Typing a non-match keeps it as a free-text name.
                        const selected = pickers.offerings.find((o) => o.id === r.offeringId);
                        if (selected && selected.name === text) return;
                        patchItem(r.key, { offeringId: '', name: text });
                      }}
                    />
                    <input
                      value={r.quantity}
                      onChange={(e) => patchItem(r.key, { quantity: e.target.value })}
                      inputMode="decimal"
                      aria-label="Quantity"
                      className={`${INPUT_SM} text-right tabular-nums`}
                    />
                    <input
                      value={r.unitAmount}
                      onChange={(e) => patchItem(r.key, { unitAmount: e.target.value })}
                      placeholder="0,00"
                      inputMode="decimal"
                      aria-label="Unit price"
                      className={`${INPUT_SM} text-right tabular-nums`}
                    />
                    <select
                      value={r.repeat}
                      onChange={(e) =>
                        patchItem(r.key, { repeat: e.target.value as RepeatCadence | '' })
                      }
                      aria-label="Repeat"
                      className={INPUT_SM}
                    >
                      <option value="">—</option>
                      {CADENCES.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                    <div className="whitespace-nowrap text-right tabular-nums">
                      {weighted == null ? (
                        <span className="select-none text-xs text-ink-muted">—</span>
                      ) : (
                        <>
                          <span className="text-sm font-medium text-ink">{money(weighted)}</span>
                          {weighted !== full && (
                            <span className="ml-1.5 text-xs text-ink-muted">{money(full!)}</span>
                          )}
                        </>
                      )}
                    </div>
                    <button
                      type="button"
                      aria-label="Remove offering row"
                      onClick={() => setItemRows((rs) => rs.filter((x) => x.key !== r.key))}
                      className="inline-flex h-6 w-6 items-center justify-center rounded-md text-ink-muted hover:bg-surface-sunken hover:text-ink"
                    >
                      <X size={14} strokeWidth={1.75} />
                    </button>
                  </div>
                );
              })}
              {/* The table's full-bleed footer row. */}
              <button
                type="button"
                onClick={() => addItemRow()}
                className="flex w-full items-center gap-1.5 px-7 py-2 text-left text-xs font-medium text-ink-subtle hover:bg-surface-sunken hover:text-ink"
              >
                <Plus size={13} strokeWidth={2} />
                add offering
              </button>
            </div>
          </div>
        ) : (
          /* LEGACY single deal size — quantity × unit price. */
          <div className={`${BLEED} border-y border-line px-7 py-3`}>
            <div className="grid grid-cols-3 items-end gap-3">
              <div>
                <label className={LABEL}>Quantity</label>
                <input
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  inputMode="decimal"
                  className={INPUT}
                />
              </div>
              <div>
                <label className={LABEL}>Unit price €</label>
                <input
                  value={unitAmount}
                  onChange={(e) => setUnitAmount(e.target.value)}
                  placeholder="0,00"
                  inputMode="decimal"
                  className={INPUT}
                />
              </div>
              <div className="pb-1">
                {legacyFull > 0 ? (
                  <span className="text-sm font-medium tabular-nums text-ink">
                    = {money(legacyFull)}
                  </span>
                ) : (
                  <span className="text-xs text-ink-muted">= deal size</span>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() =>
                // Converting seeds the first offering row from the legacy
                // fields so nothing is retyped.
                addItemRow({
                  offeringId: offeringId || '',
                  name:
                    pickers.offerings.find((o) => o.id === offeringId)?.name || label || '',
                  quantity: quantity || '1',
                  unitAmount,
                  repeat: repeatCadence,
                })
              }
              className="mt-2 text-xs text-ink-subtle underline underline-offset-2 hover:text-ink"
            >
              + add offering
            </button>
          </div>
        )}

        {/* TOTALS — the invoice's bottom-right block: weighted / full / VAT
            (tariff select inline) / TOTAL incl VAT bold. */}
        <div className="flex justify-end">
          <div className="w-72 max-w-full space-y-1 text-sm">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-ink-muted">
                Weighted{direction === 'in' && effProb < 100 ? ` (${effProb}%)` : ''}
              </span>
              <span className="font-medium tabular-nums text-ink">{money(weightedTotal)}</span>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-ink-muted">Full price</span>
              <span className="tabular-nums text-ink">{money(fullTotal)}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <select
                value={vatPct}
                onChange={(e) => setVatPct(e.target.value)}
                aria-label="VAT tariff"
                className="h-9 rounded-md border border-line bg-surface-raised px-2 text-xs focus:outline-none focus:ring-2 focus:ring-neutral-300"
              >
                <option value="">No VAT</option>
                {pickers.vatTariffs.map((t) => (
                  <option key={`${t.label}-${t.pct}`} value={String(t.pct)}>
                    {t.label}
                  </option>
                ))}
                {vatIsCustom && <option value={vatPct}>{vatPct}%</option>}
              </select>
              <span className="tabular-nums text-ink-muted">
                {vatNumber != null ? money(totalInclVat - fullTotal) : '—'}
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-3 border-t border-line pt-1.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-ink">
                Total incl VAT
              </span>
              <span className="text-base font-semibold tabular-nums text-ink">
                {money(totalInclVat)}
              </span>
            </div>
          </div>
        </div>

        {/* ---- More options -------------------------------------------------
            The full payments editor (multi-payment schedules) + the legacy
            commitment-level Offering. Project/Owner/Team live in the "More"
            disclosure under the contact band; Notes sits at the bottom. */}
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
              {!itemsMode && (
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className={LABEL}>Offering</label>
                    <select
                      value={offeringId}
                      onChange={(e) => {
                        setOfferingId(e.target.value);
                        const off = pickers.offerings.find((o) => o.id === e.target.value);
                        prefillLabel(off?.name);
                        // Offering's default price prefills the unit price when empty.
                        if (off?.default_amount_cents != null && !unitAmount.trim()) {
                          setUnitAmount(centsToInput(off.default_amount_cents));
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
              )}
            </div>
          )}
        </div>

        {/* INVOICE SECTION — the transfer lives at the bottom (spec items
            9+10) and is ALWAYS present for income (Sjoerd 2026-07-09: "Still
            I don't see the button"): enabled once the item is saved and not
            yet invoiced; on a NEW/unsaved item it shows disabled with a
            save-first hint; once invoiced it becomes the compact Invoice
            date (read-only) + Expected (editable, same first-payment
            binding) + the badge. */}
        {direction === 'in' && (
          <div className="border-t border-line pt-3">
            {invoicedNo ? (
              <div className="flex items-end gap-3">
                <div className="w-40 shrink-0">
                  <label className={LABEL}>Invoice date</label>
                  <div className="flex h-9 items-center truncate rounded-md border border-line bg-surface-sunken px-3 text-sm text-ink">
                    {fmtDateDisplay(
                      // Freshly transferred in this session → issued today.
                      commitment?.invoice_issued_at?.slice(0, 10) ?? todayIso(),
                    )}
                  </div>
                </div>
                {!repeating && (
                  <CompactDateField
                    className="w-40 shrink-0"
                    label="Expected"
                    name="expected_date"
                    defaultValue={expectedDate}
                    onValueChange={onExpectedDate}
                  />
                )}
                <span className="mb-2 ml-auto shrink-0 rounded-full bg-sky-50 px-2 py-px text-xs font-medium text-sky-700 ring-1 ring-sky-200">
                  Invoice {invoicedNo}
                </span>
              </div>
            ) : (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full"
                  disabled={busy || !commitment}
                  title={commitment ? undefined : 'Save first, then invoice'}
                  onClick={() => setInvoiceOpen(true)}
                >
                  Turn offering into an invoice
                </Button>
                {!commitment && (
                  <p className="mt-1 text-center text-xs text-ink-muted">
                    Save first, then invoice.
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {/* NOTES — last before the footer (spec item 11). */}
        <div className="border-t border-line pt-3">
          <label className={LABEL}>Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Optional"
            className={TEXTAREA}
          />
        </div>

        {/* Field VALIDATION only — server/API errors pop as toasts. */}
        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
      </form>
    </Dialog>

    {/* Nested popups — rendered AFTER the main dialog so the later sibling
        paints on top (same z-50). The main dialog's onClose is guarded. */}
    {addPersonOpen && (
      <AddPersonDialog
        orgName={selectedOrgName}
        persons={persons}
        memberIds={memberIdsRef.current ?? new Set()}
        onPickExisting={(id) => {
          setAddPersonOpen(false);
          handleSelectPerson(id); // non-members hit the link-confirm as usual
        }}
        onCreateNew={async (name, email) => {
          const res = await handleCreatePerson(name, email);
          if (res.error || !res.option) return res.error ?? 'unknown error';
          setAddPersonOpen(false);
          setPersonId(res.option.id);
          return null;
        }}
        onClose={() => setAddPersonOpen(false)}
      />
    )}
    {invoiceOpen && commitment && (
      <InvoiceDialog
        commitmentId={commitment.id}
        totalInclVat={totalInclVat}
        vatPct={vatNumber}
        counterpartyEmail={counterpartyEmail}
        onInvoiced={(no) => {
          setInvoicedNo(no);
          router.refresh();
        }}
        onClose={() => setInvoiceOpen(false)}
      />
    )}
    </>
  );
}

// ---------------------------------------------------------------------------
// "Add person…" — the strict person picker's escape hatch (Sjoerd
// 2026-07-09): search ALL existing contacts, or create a new one.
// ---------------------------------------------------------------------------
function AddPersonDialog({
  orgName,
  persons,
  memberIds,
  onPickExisting,
  onCreateNew,
  onClose,
}: {
  orgName: string;
  persons: PersonOption[];
  memberIds: Set<string>;
  onPickExisting: (id: string) => void;
  onCreateNew: (name: string, email: string) => Promise<string | null>; // error | null
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const q = query.trim().toLowerCase();
  const matches = (q
    ? persons.filter(
        (p) =>
          personName(p).toLowerCase().includes(q) ||
          (p.email ?? '').toLowerCase().includes(q),
      )
    : persons
  ).slice(0, 8);

  async function create() {
    if (!newName.trim()) {
      setError('A name is required.'); // validation — stays inline
      return;
    }
    setBusy(true);
    setError(null);
    const err = await onCreateNew(newName.trim(), newEmail.trim());
    setBusy(false);
    if (err) toastError(`Could not create the person: ${err}`); // server → toast
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title="Add person"
      description={<>Pick an existing contact or create a new one for {orgName}.</>}
      size="sm"
      footer={
        <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
      }
    >
      {creating ? (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Name</label>
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className={INPUT}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="name@example.com"
              className={INPUT}
            />
          </div>
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setCreating(false)}
              className="text-xs text-ink-subtle underline underline-offset-2 hover:text-ink"
            >
              ← back to search
            </button>
            <Button type="button" size="sm" disabled={busy} onClick={() => void create()}>
              {busy ? 'Creating…' : `Create & link to ${orgName}`}
            </Button>
          </div>
          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search contacts…"
            className={INPUT}
          />
          <ul className="max-h-56 overflow-y-auto divide-y divide-line/60">
            {matches.length === 0 && (
              <li className="px-1 py-2 text-sm text-ink-muted">No matching contacts.</li>
            )}
            {matches.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => onPickExisting(p.id)}
                  className="flex w-full items-center gap-2 px-1 py-2 text-left text-sm hover:bg-surface-sunken rounded-md"
                >
                  <span className="min-w-0 flex-1 truncate text-ink">{personName(p)}</span>
                  {memberIds.has(p.id) ? (
                    <span className="shrink-0 text-xs text-ink-muted">at {orgName}</span>
                  ) : (
                    p.email && <span className="shrink-0 text-xs text-ink-muted">{p.email}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => {
              setNewName(query.trim());
              setCreating(true);
              setError(null);
            }}
            className="w-full rounded-md border border-dashed border-line px-3 py-2 text-left text-sm font-medium text-ink-subtle hover:text-ink hover:bg-surface-sunken"
          >
            + Create new person{query.trim() ? ` ‘${query.trim()}’` : ''}
          </button>
        </div>
      )}
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Transfer to invoice — the nested confirm (proposal §2.8). The API assigns
// the number from Settings, writes the ledger row and moves the stage; with
// send it also emails the counterparty.
// ---------------------------------------------------------------------------
function InvoiceDialog({
  commitmentId,
  totalInclVat,
  vatPct,
  counterpartyEmail,
  onInvoiced,
  onClose,
}: {
  commitmentId: string;
  totalInclVat: number;
  vatPct: number | null;
  counterpartyEmail: string | null;
  onInvoiced: (invoiceNo: string) => void;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState<false | 'create' | 'send'>(false);
  const [result, setResult] = useState<{
    invoice_no: string;
    sent: boolean;
    note: string | null;
  } | null>(null);

  async function run(send: boolean) {
    setBusy(send ? 'send' : 'create');
    const res = await invoiceCommitment(commitmentId, send);
    setBusy(false);
    if (res.error || !res.data) {
      // Server failure → toast (pops above this nested dialog).
      toastError(`Could not create the invoice: ${res.error ?? 'unknown error'}`);
      return;
    }
    setResult(res.data);
    onInvoiced(res.data.invoice_no);
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title="Create invoice"
      size="sm"
      footer={
        result ? (
          <Button type="button" onClick={onClose}>
            Close
          </Button>
        ) : (
          <>
            <Button type="button" variant="secondary" onClick={onClose} disabled={!!busy}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={!!busy}
              onClick={() => void run(false)}
            >
              {busy === 'create' ? 'Creating…' : 'Create invoice'}
            </Button>
            <Button
              type="button"
              disabled={!!busy || !counterpartyEmail}
              onClick={() => void run(true)}
            >
              {busy === 'send' ? 'Sending…' : 'Create & send'}
            </Button>
          </>
        )
      }
    >
      {result ? (
        <div className="space-y-2 text-sm">
          <p>
            Invoice{' '}
            <span className="rounded-full bg-sky-50 px-2 py-px text-xs font-medium text-sky-700 ring-1 ring-sky-200">
              {result.invoice_no}
            </span>{' '}
            created.
          </p>
          <p className="text-ink-muted">
            {result.sent
              ? `Sent to ${counterpartyEmail ?? 'the counterparty'}.`
              : result.note ?? 'Saved — not sent.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3 text-sm">
          <p className="text-ink-muted">
            The number is assigned from Settings → Planner → Invoicing (next in the sequence). This
            transfers the opportunity to the invoices ledger and can&apos;t be undone here.
          </p>
          <div className="flex items-center justify-between rounded-md bg-surface-sunken px-3 py-2">
            <span className="text-ink-muted">
              Total incl VAT{vatPct != null ? ` (${vatPct}%)` : ''}
            </span>
            <span className="font-semibold tabular-nums">{money(totalInclVat)}</span>
          </div>
          <p className="text-xs text-ink-muted">
            Uses the saved opportunity — save your changes first if you edited anything.
          </p>
          {!counterpartyEmail && (
            <p className="text-xs text-amber-700">
              No email on the contact person — &ldquo;Create &amp; send&rdquo; needs one; you can
              still create the invoice and send it later from the Invoices area.
            </p>
          )}
        </div>
      )}
    </Dialog>
  );
}
