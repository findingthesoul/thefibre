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
