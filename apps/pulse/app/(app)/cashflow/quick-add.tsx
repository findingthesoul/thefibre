'use client';

// Quick add (Sjoerd 2026-07-08: "We should have a quick add (contact and €)
// ... and a more extended"). One combobox over ALL counterparties (orgs +
// people), an amount, a date — defaults do the rest (income, Lead, you as
// owner). The extended dialog picks it up from there.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Zap } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { DateField } from '@/components/ui/date-field';
import { Combobox, type ComboOption } from './combobox';
import { createOrganisation, saveCommitment } from './actions';
import type { OrgOption, PersonOption } from './types';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function parseEuros(raw: string): number | null {
  const n = parseFloat(raw.replace(',', '.'));
  if (Number.isNaN(n)) return null;
  return Math.round(n * 100);
}

export function QuickAddButton({
  orgs,
  persons,
}: {
  orgs: OrgOption[];
  persons: PersonOption[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="secondary"
        leading={<Zap size={15} strokeWidth={2} />}
        onClick={() => setOpen(true)}
      >
        Quick add
      </Button>
      {open && <QuickAddDialog orgs={orgs} persons={persons} onClose={() => setOpen(false)} />}
    </>
  );
}

function QuickAddDialog({
  orgs,
  persons,
  onClose,
}: {
  orgs: OrgOption[];
  persons: PersonOption[];
  onClose: () => void;
}) {
  const router = useRouter();
  // One list, both kinds — the id encodes which table the pick came from.
  const [extraOrgs, setExtraOrgs] = useState<ComboOption[]>([]);
  const options: ComboOption[] = [
    ...orgs.map((o) => ({ id: `org:${o.id}`, label: o.name, sublabel: 'organisation' })),
    ...persons.map((p) => ({
      id: `per:${p.id}`,
      label: `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || (p.email ?? 'Unnamed'),
      sublabel: p.email,
    })),
    ...extraOrgs,
  ];
  const [counterparty, setCounterparty] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayIso());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e?: React.FormEvent<HTMLFormElement>) {
    e?.preventDefault();
    const cents = parseEuros(amount);
    if (!counterparty) {
      setError('Pick (or create) a contact.');
      return;
    }
    if (cents === null || cents === 0) {
      setError('Amount is required.');
      return;
    }
    if (!date) {
      setError('Expected date is required.');
      return;
    }
    const picked = options.find((o) => o.id === counterparty);
    const [kind, rawId] = counterparty.split(':');
    setBusy(true);
    setError(null);
    const res = await saveCommitment({
      id: null,
      commitment: {
        direction: 'in',
        label: picked?.label ?? 'New opportunity',
        organisation_id: kind === 'org' ? rawId! : null,
        person_id: kind === 'per' ? rawId! : null,
        team_id: null,
        project_id: null,
        offering_id: null,
        notes: null,
        stage: 'lead',
        probability: 50,
      },
      lines: [
        {
          expected_date: date,
          amount_cents: cents,
          invoice_ref: null,
          invoiced_at: null,
          settled_at: null,
        },
      ],
      originalLineIds: [],
    });
    if (res.error) {
      setError(res.error);
      setBusy(false);
      return;
    }
    onClose();
    router.refresh();
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title="Quick add"
      description="A contact and an amount — details can come later."
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form="quick-add-form" disabled={busy}>
            {busy ? 'Adding…' : 'Add'}
          </Button>
        </>
      }
    >
      <form id="quick-add-form" onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Contact</label>
          <Combobox
            options={options}
            value={counterparty}
            onSelect={setCounterparty}
            placeholder="Start typing a person or organisation…"
            onCreate={async (query) => {
              const r = await createOrganisation(query.trim());
              if (r.error || !r.data) return { error: r.error ?? 'create failed' };
              const opt = {
                id: `org:${r.data.id}`,
                label: r.data.name,
                sublabel: 'organisation · new',
              };
              setExtraOrgs((prev) => [...prev, opt]);
              return { option: opt };
            }}
          />
          <p className="mt-1 text-xs text-ink-muted">
            Creating here makes an organisation. For a new person, use the extended dialog
            (people need an email).
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Amount €</label>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0,00"
              inputMode="decimal"
              className="w-full rounded-md border border-line px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300"
            />
          </div>
          <DateField
            label="Expected"
            name="quick_expected"
            defaultValue={date}
            onValueChange={setDate}
          />
        </div>
      </form>
    </Dialog>
  );
}
