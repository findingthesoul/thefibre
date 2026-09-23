'use server';

// The two writes the agenda can make: add somebody who is in a meeting with
// you, and choose which calendars the agenda reads at all.
//
// Both are per-user. Neither decides anything — the rules are in the API
// (routes/connections-agenda.ts, routes/connections-calendars.ts and
// lib/agenda-calendars.ts); this file carries the call and the refresh.

import { revalidatePath } from 'next/cache';
import { apiFetch, ApiError } from '@/lib/api';

export type AddAgendaPersonResult =
  | { ok: true; personId: string; created: boolean }
  /** `gone` — the meeting moved or the address left it while the page sat
   *  open. `failed` covers everything else; the API logged the detail. */
  | { ok: false; reason: 'gone' | 'no_calendar' | 'failed' };

export async function addAgendaPerson(email: string): Promise<AddAgendaPersonResult> {
  try {
    const r = await apiFetch<{ person_id: string; created: boolean }>(
      '/api/v1/connections/agenda/person',
      { method: 'POST', body: JSON.stringify({ email }) },
    );
    // Today shows the agenda, the person's own page shows their notes; both
    // are now out of date about whether this address is somebody.
    revalidatePath('/today');
    revalidatePath('/people');
    return { ok: true, personId: r.person_id, created: r.created };
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return { ok: false, reason: 'gone' };
    if (e instanceof ApiError && e.status === 400) return { ok: false, reason: 'no_calendar' };
    return { ok: false, reason: 'failed' };
  }
}

export type AgendaCalendar = {
  id: string;
  summary: string;
  owned: boolean;
  primary: boolean;
  enabled: boolean;
  chosen: boolean;
};

export type CalendarList = {
  connected: boolean;
  unavailable?: boolean;
  calendars: AgendaCalendar[];
};

export async function loadCalendars(): Promise<CalendarList> {
  try {
    return await apiFetch<CalendarList>('/api/v1/connections/calendars');
  } catch {
    // Told apart from "you have none": the picker says the list could not be
    // read rather than showing an empty one.
    return { connected: true, unavailable: true, calendars: [] };
  }
}

export async function saveCalendars(
  calendars: { id: string; enabled: boolean }[],
): Promise<{ ok: boolean }> {
  try {
    await apiFetch('/api/v1/connections/calendars', {
      method: 'PUT',
      body: JSON.stringify({ calendars }),
    });
    revalidatePath('/today');
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

/**
 * Put this calendar address on a person already on file.
 *
 * Sjoerd, 2026-09-23: *"in fibre this person exist... but the TODAY meeting
 * does not recognize it."* It could not: the agenda matches on an address and
 * that person had none — this app has been able to create a person from a
 * name alone since v0.95.0, and those people are invisible to the calendar
 * for ever.
 *
 * Attaching the address is what makes it permanent: every later meeting with
 * them matches by itself, with no guessing at any point. The guess was only
 * ever in the OFFER, and a person accepted it.
 */
export async function attachAddress(
  personId: string,
  email: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await apiFetch(`/api/v1/persons/${personId}`, {
      method: 'PATCH',
      body: JSON.stringify({ email }),
    });
    revalidatePath('/today');
    revalidatePath('/people');
    return { ok: true };
  } catch (e) {
    if (e instanceof ApiError && e.status === 409) return { ok: false, error: 'taken' };
    return { ok: false, error: 'failed' };
  }
}
