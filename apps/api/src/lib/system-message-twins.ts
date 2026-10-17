// A thread's two system messages and their ordinary TWINS (2026-10-17).
//
// Sjoerd, production: on a new team thread the automatic "You're enrolled"
// had to be deleted twice. The thread came from a template saved before
// 2026-10-15, when templates did not yet carry `system_role`: its copy of the
// message arrived as an ordinary message, and the first editor load
// (ensureSystemEngagements) seeded the real one beside it. Two rows that look
// the same, both sent to every new participant, only one with the ticket.
//
// Two rules, both decided here and nowhere else:
//   · ADOPT, DON'T ADD. Before seeding a system message, an ordinary message
//     on the same trigger whose title is that message's default (in any of
//     the six languages) becomes the system message instead.
//   · A thread that already has both is not changed behind the organiser's
//     back: the ordinary one is FLAGGED as a twin, and the editor says so.
//
// The organiser's own words are left alone: only the default TITLE identifies
// a twin (they may have edited the body), and a message they titled
// themselves is never touched.

import { LOCALES } from '@thefibre/shared';
import { systemMessageDefaults } from './email/thread-templates.js';

export type SystemRole = 'enrolment_confirmed' | 'enrolment_received';

/** The triggers a system message can fire on. */
const TRIGGERS: Record<SystemRole, readonly string[]> = {
  enrolment_confirmed: ['on_enrolment', 'on_approval'],
  enrolment_received: ['on_application'],
};

const titles = new Map<SystemRole, Set<string>>();
/** The role's default title in every language, as seeded. */
export function defaultTitles(role: SystemRole): Set<string> {
  let s = titles.get(role);
  if (!s) {
    s = new Set(LOCALES.map((l) => systemMessageDefaults(l)[role].title.trim()));
    titles.set(role, s);
  }
  return s;
}

export type MessageRow = {
  id: string;
  type: string;
  title: string | null;
  trigger_kind: string | null;
  system_role?: string | null;
};

/** Is this ordinary message a copy of `role`'s system message? */
export function isTwin(row: MessageRow, role: SystemRole): boolean {
  if (row.system_role) return false;
  if (row.type !== 'message') return false;
  if (!row.trigger_kind || !TRIGGERS[role].includes(row.trigger_kind)) return false;
  return defaultTitles(role).has((row.title ?? '').trim());
}

/** The ordinary message to adopt as `role`, when there is one. */
export function adoptable(rows: MessageRow[], role: SystemRole): MessageRow | null {
  return rows.find((r) => isTwin(r, role)) ?? null;
}

/** The ordinary messages that duplicate a system message the thread HAS:
 *  id → the role they copy. */
export function twinsOf(rows: MessageRow[]): Map<string, SystemRole> {
  const present = new Set(rows.map((r) => r.system_role).filter(Boolean) as string[]);
  const out = new Map<string, SystemRole>();
  for (const role of ['enrolment_confirmed', 'enrolment_received'] as const) {
    if (!present.has(role)) continue;
    for (const r of rows) if (isTwin(r, role)) out.set(r.id, role);
  }
  return out;
}
