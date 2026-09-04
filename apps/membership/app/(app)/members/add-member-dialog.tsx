'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog } from '@/components/ui/dialog';
import { DateField } from '@/components/ui/date-field';
import { Button } from '@/components/ui/button';
import { createMember, createPerson, searchPersons } from './actions';
import { dateToIso } from './member-dialog';
import { personName, type MemberPerson, type Tier } from './types';

const INPUT =
  'w-full rounded-md border border-line bg-surface-raised px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300';

export function AddMemberDialog({ tiers, onClose }: { tiers: Tier[]; onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MemberPerson[]>([]);
  const [person, setPerson] = useState<MemberPerson | null>(null);
  // New-contact mode: the typed name isn't a contact yet — create one
  // inline instead of dead-ending on "pick a person first".
  const [newContact, setNewContact] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [tierId, setTierId] = useState(tiers[0]?.id ?? '');
  const [renewsAt, setRenewsAt] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debounced search-as-you-type; results come via a server action because
  // the API session lives server-side.
  useEffect(() => {
    if (person || query.trim().length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(() => {
      searchPersons(query.trim()).then((r) => setResults(r.data?.items ?? []));
    }, 250);
    return () => clearTimeout(t);
  }, [query, person]);

  async function submit(e?: React.FormEvent<HTMLFormElement>) {
    e?.preventDefault();
    if (!person && !newContact) {
      setError('Pick a person, or create a new contact.');
      return;
    }
    if (!tierId) {
      setError('Pick a tier.');
      return;
    }
    setBusy(true);
    setError(null);

    let personId = person?.id ?? null;
    if (!personId && newContact) {
      const name = newName.trim();
      if (!name || !newEmail.trim()) {
        setError('A new contact needs a name and an email address.');
        setBusy(false);
        return;
      }
      const parts = name.split(/\s+/);
      const created = await createPerson({
        first_name: parts[0] ?? name,
        last_name: parts.slice(1).join(' ') || '',
        email: newEmail.trim(),
      });
      if (created.error || !created.data) {
        setError(created.error ?? 'could not create the contact');
        setBusy(false);
        return;
      }
      personId = created.data.id;
    }

    const res = await createMember({
      person_id: personId!,
      tier_id: tierId,
      renews_at: renewsAt ? dateToIso(renewsAt) : null,
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
      title="Add member"
      description="Manual add — for invoiced or comped memberships. Paid joins come through the join page."
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form="add-member-form" disabled={busy}>
            {busy ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      <form id="add-member-form" onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Person</label>
          {person ? (
            <div className="flex items-center justify-between rounded-md border border-line bg-surface-sunken px-3 py-2 text-sm">
              <div>
                <span className="text-ink">{personName(person)}</span>
                {person.email && <span className="ml-2 text-ink-muted">{person.email}</span>}
              </div>
              <button
                type="button"
                className="text-xs text-ink-subtle hover:text-ink underline"
                onClick={() => {
                  setPerson(null);
                  setQuery('');
                }}
              >
                Change
              </button>
            </div>
          ) : newContact ? (
            <div className="space-y-2 rounded-md border border-line bg-surface-sunken p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-wider text-ink-muted">New contact</span>
                <button
                  type="button"
                  className="text-xs text-ink-subtle hover:text-ink underline"
                  onClick={() => setNewContact(false)}
                >
                  Search instead
                </button>
              </div>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Full name"
                className={INPUT}
              />
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="Email address"
                className={INPUT}
              />
              <p className="text-xs text-ink-muted">
                Creates the contact in The Fibre, then adds the membership.
              </p>
            </div>
          ) : (
            <>
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search contacts by name or email…"
                className={INPUT}
              />
              {results.length > 0 && (
                <ul className="mt-1 rounded-md border border-line bg-surface-raised divide-y divide-line/60 overflow-hidden">
                  {results.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => setPerson(p)}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-surface-sunken"
                      >
                        <span className="text-ink">{personName(p)}</span>
                        {p.email && <span className="ml-2 text-ink-muted">{p.email}</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {query.trim().length >= 2 && (
                <button
                  type="button"
                  className="mt-1.5 w-full rounded-md border border-dashed border-line px-3 py-2 text-left text-sm text-ink-subtle hover:text-ink hover:bg-surface-sunken"
                  onClick={() => {
                    setNewContact(true);
                    setNewName(query.trim());
                  }}
                >
                  ＋ Create “{query.trim()}” as a new contact
                </button>
              )}
            </>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Tier</label>
          <select value={tierId} onChange={(e) => setTierId(e.target.value)} className={INPUT}>
            {tiers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <DateField
          label="Renews on"
          name="renews_at"
          defaultValue={renewsAt || null}
          onValueChange={setRenewsAt}
          hint="Optional — the scheduler moves overdue manual members to grace, then lapsed."
        />
        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
      </form>
    </Dialog>
  );
}
