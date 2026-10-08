// Which member a detail page may show, given the list it was handed.
//
// This is the only decision on that page, and it is a privacy decision, so it
// lives here where it can be tested rather than inside a server component
// where it cannot.
//
// The rule is deliberately small, because the LIST already applied the eleven
// that matter (membership, grace but not lapsed, listed, not deleted, not
// you, category scope, and what contact details may be shown). The page's job
// is only to not be more generous than what it was given:
//
//   a failed load is NOT "this person is not available" — saying that would
//   turn our outage into a statement about somebody's membership;
//   a viewer who is not listed sees nobody, list or detail;
//   and only a row actually present in `items` can be rendered.

import type { DirectoryList, DirectoryMember } from './portal-api';

export type MemberView =
  | { kind: 'member'; member: DirectoryMember }
  /** The load failed. Nothing is known; say that, not "not available". */
  | { kind: 'failed' }
  /** Everything else — lapsed, unlisted, another category, soft-deleted, or
   *  no such person. ONE answer on purpose: a page that told these apart
   *  would answer questions about people the viewer may not ask about. */
  | { kind: 'unavailable' };

export function pickMember(list: DirectoryList, personId: string): MemberView {
  if (list.state === 'failed') return { kind: 'failed' };
  if (list.state !== 'ok' || !list.you_are_listed) return { kind: 'unavailable' };
  const member = list.items.find((m) => m.person_id === personId);
  return member ? { kind: 'member', member } : { kind: 'unavailable' };
}
