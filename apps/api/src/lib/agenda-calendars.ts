// Which calendars feed Connections' agenda, for one person.
//
// Sjoerd, 2026-09-21: *"select agenda's available to me. And select one or
// more... And then put agenda's on and off."*
//
// Two routes read the calendar — Today (two weeks) and the agenda (one day) —
// and both must honour the same choice, so the resolving lives here rather
// than in either of them.
//
// THE DEFAULT IS THE OLD BEHAVIOUR. An absent row means on when the person
// owns the calendar and off when they only subscribe to it, which is exactly
// what listEvents did before the choice existed (`minAccessRole: 'owner'`).
// Nobody's agenda changes on the day this ships; a calendar made next month
// shows up by itself; a subscribed holiday feed stays out until it is picked.

import { adminClient } from '../db.js';
import { listCalendars } from './google/client.js';

export type AgendaCalendar = {
  id: string;
  summary: string;
  /** The person's own calendar, as opposed to one they read. Decides the
   *  default, and the picker groups by it. */
  owned: boolean;
  primary: boolean;
  /** Resolved: the stored choice, or the default when nothing is stored. */
  enabled: boolean;
  /** True when somebody made this choice on purpose. The picker does not show
   *  it; the tests do, and so does anyone reading a support question. */
  chosen: boolean;
};

/** Google calls owner and writer "can change it"; both are the person's own
 *  in the sense that matters here. Reader/freeBusyReader are subscriptions. */
export function isOwned(accessRole: string | null): boolean {
  return accessRole === 'owner' || accessRole === 'writer';
}

type StoredRow = { calendar_id: string; enabled: boolean };

async function stored(workspaceId: string, userId: string): Promise<Map<string, boolean>> {
  const { data, error } = await adminClient
    .from('connections_agenda_calendar')
    .select('calendar_id, enabled')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId);
  if (error) {
    // A stored choice that cannot be read must not take the agenda down with
    // it — falling back to the default shows too much of nothing, never
    // somebody else's calendar.
    console.warn('[agenda-calendars] read failed', error.message);
    return new Map();
  }
  return new Map((data ?? []).map((r) => [(r as StoredRow).calendar_id, (r as StoredRow).enabled]));
}

/** What Google's calendarList gives us, narrowed to what this decision needs. */
export type GoogleCalendar = {
  id: string;
  summary: string;
  primary: boolean;
  accessRole: string | null;
};

/**
 * The choice, resolved against the live list. Pure, so the defaulting rule —
 * the part that decides whose meetings somebody sees — is testable without a
 * Google token or a database.
 */
export function resolveCalendars(
  all: GoogleCalendar[],
  choice: Map<string, boolean>,
): AgendaCalendar[] {
  return all
    .filter((c) => c.id)
    .map((c) => {
      const owned = isOwned(c.accessRole);
      const pick = choice.get(c.id);
      return {
        id: c.id,
        summary: c.summary || c.id,
        owned,
        primary: c.primary,
        enabled: pick ?? owned,
        chosen: pick !== undefined,
      };
    })
    .sort((a, b) => {
      // Your own first, your primary at the very top: the list reads as "my
      // calendars, then the ones I follow".
      if (a.primary !== b.primary) return a.primary ? -1 : 1;
      if (a.owned !== b.owned) return a.owned ? -1 : 1;
      return a.summary.localeCompare(b.summary);
    });
}

/** Every calendar the person can read, with the choice resolved on each. */
export async function agendaCalendars(
  refreshToken: string,
  workspaceId: string,
  userId: string,
): Promise<AgendaCalendar[]> {
  const [all, choice] = await Promise.all([
    listCalendars(refreshToken),
    stored(workspaceId, userId),
  ]);
  return resolveCalendars(all, choice);
}

/**
 * Just the ids to read events from. `[]` is a real answer — somebody who
 * switched every calendar off asked for an empty agenda, and the callers must
 * not read that as "no preference" and show them everything.
 */
export async function enabledCalendarIds(
  refreshToken: string,
  workspaceId: string,
  userId: string,
): Promise<string[]> {
  const cals = await agendaCalendars(refreshToken, workspaceId, userId);
  return cals.filter((c) => c.enabled).map((c) => c.id);
}
