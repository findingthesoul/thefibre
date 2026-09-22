'use server';

// Connect's binding of THE person picker (@thefibre/shared/ui/person-combobox).
//
// The component is shared; these two are not, and cannot be: a server action
// is bound to one app's apiFetch and its session. Deliberately the same shapes
// as apps/web/lib/person-actions.ts, so the two bindings of one component do
// not drift into two behaviours.

import { apiFetch } from '@/lib/api';
import type { PersonOption } from '@thefibre/shared/ui/person-combobox';

/** Matched server-side on first name, last name or email, under the caller's
 *  own RLS — the picker can never offer somebody they could not already see. */
export async function searchPeople(q: string): Promise<PersonOption[]> {
  const term = q.trim();
  const params = new URLSearchParams({ limit: '20' });
  if (term) params.set('q', term);
  try {
    const data = await apiFetch<{ items: PersonOption[] }>(`/api/v1/persons?${params}`);
    return data.items;
  } catch {
    // The picker keeps whatever it already had rather than emptying itself
    // because one keystroke's request failed.
    return [];
  }
}

export type CreatePersonResult =
  | { ok: true; person: PersonOption }
  | { ok: false; error: string };

/**
 * Somebody who was in the room and is not on file — created from the name as
 * typed, with no address.
 *
 * Sjoerd, 2026-09-22, typing a name into the write-up and being told nobody
 * matched: *"when typing..., can I add people if they are not there?"*
 *
 * An address is the only thing two records can be matched on, so a person
 * created this way cannot be deduplicated later. That is why the picker
 * SEARCHES first and only then offers this, and why it is a press rather than
 * anything automatic. The rest of them — an address, a phone number — is
 * added on their own page when there is a reason to.
 */
export async function createPersonNamed(typed: string): Promise<CreatePersonResult> {
  const name = typed.trim().replace(/\s+/g, ' ');
  if (!name) return { ok: false, error: 'empty' };
  const [first, ...rest] = name.split(' ');
  try {
    const person = await apiFetch<PersonOption>('/api/v1/persons', {
      method: 'POST',
      body: JSON.stringify({
        first_name: first,
        ...(rest.length ? { last_name: rest.join(' ') } : {}),
      }),
    });
    return { ok: true, person };
  } catch (e) {
    const err = e as { status?: number; body?: { error?: unknown } };
    return {
      ok: false,
      error: typeof err.body?.error === 'string' ? err.body.error : `API ${err.status ?? ''}`.trim(),
    };
  }
}

// ── Organisations, the same arrangement ────────────────────────────────────
//
// Sjoerd, 2026-09-22: *"Add company - also a single point of truth."* The
// component is @thefibre/shared/ui/organisation-combobox; these two are
// Connect's binding of it.

import type { OrganisationOption } from '@thefibre/shared/ui/organisation-combobox';

export async function searchOrganisations(q: string): Promise<OrganisationOption[]> {
  const term = q.trim();
  const params = new URLSearchParams({ limit: '20' });
  if (term) params.set('q', term);
  try {
    const data = await apiFetch<{ items: OrganisationOption[] }>(
      `/api/v1/organisations?${params}`,
    );
    return data.items;
  } catch {
    return [];
  }
}

export type CreateOrganisationResult =
  | { ok: true; organisation: OrganisationOption }
  | { ok: false; error: string };

/** A company from the name as typed. `POST /organisations` has always asked
 *  for nothing but a name, so unlike a person this needed no widening. */
export async function createOrganisationNamed(typed: string): Promise<CreateOrganisationResult> {
  const name = typed.trim().replace(/\s+/g, ' ');
  if (!name) return { ok: false, error: 'empty' };
  try {
    const organisation = await apiFetch<OrganisationOption>('/api/v1/organisations', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
    return { ok: true, organisation };
  } catch (e) {
    const err = e as { status?: number; body?: { error?: unknown } };
    return {
      ok: false,
      error: typeof err.body?.error === 'string' ? err.body.error : `API ${err.status ?? ''}`.trim(),
    };
  }
}
