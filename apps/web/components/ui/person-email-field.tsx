'use client';

// Naming a person by address — from the contact book, not from memory.
//
// Sjoerd, 2026-09-26, on the plain email input this replaced: *"the forst
// admin field is not a single point of truth field.. it does not search in
// the fibre..."*. He is right, and it is the same correction he made on
// 2026-09-22 about Connect's search boxes; the rule already exists and is
// tested (packages/shared/src/ui/combobox-single-source.test.ts). That test
// only scans apps/connections, so a hand-rolled input in the admin area
// failed nothing — which is exactly how this one got written.
//
// WHICH contact book, and why that is the right one: the picker searches the
// CALLER's people, under their own RLS. The workspace being seeded is empty
// by definition, so it has no contacts to search. Picking here gets the
// address right; the seed then creates a fresh person in the target
// workspace, because a person belongs to one workspace and the data wall
// does not bend for an admin screen.

import { useState } from 'react';
import { PersonCombobox } from '@/components/ui/person-combobox';
import { personForSeeding } from '@/lib/person-actions';

export type ChosenAdmin = { email: string; name: string | null };

export function PersonEmailField({
  label = 'Person',
  value,
  onChange,
  disabled,
  placeholder = 'Search your contacts, or type an email address',
}: {
  label?: string;
  value: ChosenAdmin | null;
  onChange: (v: ChosenAdmin | null) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [personId, setPersonId] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [looking, setLooking] = useState(false);

  async function pick(id: string, label?: string) {
    setPersonId(id);
    setProblem(null);
    setLooking(true);
    const r = await personForSeeding(id);
    setLooking(false);
    if ('error' in r) {
      setProblem(r.error);
      onChange(null);
      return;
    }
    if (!r.email) {
      // A real contact with no address. Worth its own sentence: the picker
      // was right, the person exists, and they still cannot be seeded —
      // sign-in resolves an ADDRESS, so there is nothing to sign in as.
      setProblem(
        `${label ?? 'That contact'} has no email address in The Fibre. Add one on their contact page first — signing in resolves an address, so there is nothing to sign in as without it.`,
      );
      onChange(null);
      return;
    }
    onChange({ email: r.email, name: r.name });
  }

  return (
    <div className="space-y-2">
      <PersonCombobox
        label={label}
        value={personId}
        onChange={pick}
        placeholder={placeholder}
        searchPlaceholder="Name or email…"
        // Somebody who is not a contact yet — a person met this morning, the
        // usual case when a workspace is made for them. The typed text is
        // used as the address directly; no contact is created in the caller's
        // own workspace for it, because they are not the caller's contact.
        onCreate={(typed) => {
          const t = typed.trim();
          setPersonId('');
          if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(t)) {
            setProblem(`"${t}" is not an email address.`);
            onChange(null);
            return;
          }
          setProblem(null);
          onChange({ email: t, name: null });
        }}
        createLabel={(typed) => `Use "${typed.trim()}" as the address`}
        {...(disabled ? { errors: undefined } : {})}
      />

      {looking && <p className="text-xs text-ink-muted">Looking up their address…</p>}

      {value && (
        <p className="text-xs text-ink-subtle">
          Will be invited as <span className="font-medium text-ink">{value.email}</span>
          {value.name ? ` (${value.name})` : ''}.
        </p>
      )}

      {problem && <p className="text-sm text-red-600 dark:text-red-400">{problem}</p>}
    </div>
  );
}
