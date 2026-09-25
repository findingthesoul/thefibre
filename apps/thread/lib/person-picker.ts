'use server';

// Thread's binding of THE person picker (@thefibre/shared/ui/person-combobox).
//
// The component is shared; this is not, and cannot be: a server action is
// bound to one app's apiFetch and its session. Deliberately the same shape as
// apps/connections/lib/person-picker.ts and apps/web/lib/person-actions.ts,
// so three bindings of one component do not drift into three behaviours.

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
  } catch (e) {
    // THROW, never `return []`. An empty list is an answer — "nobody matches"
    // — and this is not that, it is "I could not look". Returning [] here
    // shows an empty list with "add what you typed" under it, which is how a
    // transient failure talks somebody into creating a person who already
    // exists. Connect hit exactly that on 2026-09-23; the same reasoning
    // applies harder here, because a duplicate person created from this
    // dialog also gets enrolled and emailed.
    throw e;
  }
}
