// Saying an estimate. No directive: Today (client) and the settings page
// (server) both import these values, and a value exported from a 'use client'
// module arrives in a server component as a proxy (see today/shape.ts).

import { t, type Locale, type UiKey } from '@/lib/i18n-ui';

/** The kinds the API estimates, with their names. Mirrors
 *  apps/api/src/lib/effort.ts EFFORT_KINDS; the API is the authority on which
 *  exist, and a kind this map lacks is shown by its key rather than hidden. */
export const EFFORT_KIND_KEYS: Record<string, { name: UiKey; note: UiKey }> = {
  follow_up: { name: 'effort_kind_follow_up', note: 'effort_note_follow_up' },
  flow_step: { name: 'effort_kind_flow_step', note: 'effort_note_flow_step' },
  task: { name: 'effort_kind_task', note: 'effort_note_task' },
  meeting_brief: { name: 'effort_kind_meeting_brief', note: 'effort_note_meeting_brief' },
  thread_unreached: { name: 'effort_kind_thread_unreached', note: 'effort_note_thread_unreached' },
  thread_unpaid: { name: 'effort_kind_thread_unpaid', note: 'effort_note_thread_unpaid' },
  money_uninvoiced: { name: 'effort_kind_money_uninvoiced', note: 'effort_note_money_uninvoiced' },
};

/**
 * Minutes as a person says them: "10 min", "2 h", "1 h 30 min".
 *
 * Rounded to five minutes above an hour. Estimates are defaults, and "3 h 17
 * min" claims a precision nobody measured; below an hour the exact number is
 * the one the settings page shows, so it is kept.
 */
export function formatMinutes(total: number, locale: Locale): string {
  const minutes = Math.max(0, Math.round(total));
  if (minutes < 60) return t(locale, 'effort_min', { n: minutes });
  const rounded = Math.round(minutes / 5) * 5;
  const h = Math.floor(rounded / 60);
  const m = rounded % 60;
  return m === 0 ? t(locale, 'effort_h', { n: h }) : t(locale, 'effort_h_min', { h, m });
}
