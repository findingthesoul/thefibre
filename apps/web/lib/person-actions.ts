'use server';

// Searching the contact list from a picker.
//
// The dialogs that link a person to something — an organisation's members, a
// programme's enrolments — used to be handed the first 100 contacts and a
// <select>. Both halves of that break as a workspace fills up: a hundred names
// in a scrolling list is not something you read, and contact 101 is simply
// not offered.
//
// So the picker asks the API instead. `q` matches first name, last name or
// email server-side (routes/persons.ts), under the caller's own RLS — a picker
// can never surface somebody the person using it could not already see.

import { apiFetch } from './api';

export type PersonOption = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
};

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
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

/** A new contact from inside a picker ("not in the list — add them"). The
 *  caller selects the returned person; nothing navigates away. */
export async function createPersonFromPicker(input: {
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  country?: string;
  email_label?: string;
  phone_label?: string;
}): Promise<CreatePersonResult> {
  const body = Object.fromEntries(
    Object.entries(input)
      .map(([k, v]) => [k, (v ?? '').trim()])
      .filter(([, v]) => v),
  );
  try {
    const created = await apiFetch<PersonOption>('/api/v1/persons', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return { ok: true, person: created };
  } catch (e) {
    const err = e as { status?: number; body?: { error?: { fieldErrors?: Record<string, string[]> } | string } };
    const fe = typeof err.body?.error === 'object' ? err.body.error.fieldErrors : undefined;
    return {
      ok: false,
      error: typeof err.body?.error === 'string' ? err.body.error : `API ${err.status ?? ''}`.trim(),
      ...(fe ? { fieldErrors: fe } : {}),
    };
  }
}

export type OrganisationOption = { id: string; name: string; domain: string | null };

/** The organisation picker on a person: the API matches any name,
 *  abbreviation or domain (search_names), under the caller's RLS. */
export async function searchOrganisations(q: string): Promise<OrganisationOption[]> {
  const params = new URLSearchParams({ limit: '20' });
  if (q.trim()) params.set('q', q.trim());
  try {
    const data = await apiFetch<{ items: OrganisationOption[] }>(`/api/v1/organisations?${params}`);
    return data.items;
  } catch {
    return [];
  }
}

/** "Not in the list — add it", from inside the picker. Nothing navigates. */
export async function createOrganisationFromPicker(input: {
  name: string;
  domain?: string;
  country?: string;
}): Promise<{ ok: true; organisation: OrganisationOption } | { ok: false; error: string }> {
  const body = Object.fromEntries(
    Object.entries(input)
      .map(([k, v]) => [k, (v ?? '').trim()])
      .filter(([, v]) => v),
  );
  try {
    const created = await apiFetch<OrganisationOption>('/api/v1/organisations', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return { ok: true, organisation: created };
  } catch (e) {
    const err = e as { status?: number; body?: { error?: unknown } };
    return { ok: false, error: typeof err.body?.error === 'string' ? err.body.error : `API ${err.status ?? ''}`.trim() };
  }
}

/** The email and name of a person a caller picked from the contact book.
 *
 *  The picker hands back an id and a display label; seeding needs the
 *  ADDRESS, because an address is what a sign-in resolves to. One extra
 *  round trip on selection, rather than a second copy of the search results
 *  kept in the dialog purely to look one field up. */
export async function personForSeeding(
  personId: string,
): Promise<{ email: string | null; name: string | null } | { error: string }> {
  try {
    const p = await apiFetch<{ email: string | null; first_name: string | null; last_name: string | null }>(
      `/api/v1/persons/${personId}`,
    );
    return {
      email: p.email,
      name: [p.first_name, p.last_name].filter(Boolean).join(' ') || null,
    };
  } catch (e) {
    const err = e as { status?: number };
    return {
      error:
        err.status === 404
          ? 'That contact could not be read — it may have been removed.'
          : 'Could not read that contact.',
    };
  }
}
