// What a grant SAYS, in one place.
//
// Three surfaces render an access grant as a sentence: the product dialog's
// list, the product card's one-line summary, and the tier Access list. They
// had three functions, and they already disagreed — the Access list showed a
// bare slug with an em dash for anything it did not recognise, while the
// others wrote "Thread {ref}". A fourth kind landing (`team_calendar`,
// 2026-10-12) would have made that four copies and three of them wrong, so
// this is the one.
//
// It needs the TEAMS, because a team-calendar grant stores a uuid and a uuid
// in a list of what a product confers is a row nobody can check. Teams it
// cannot resolve say so, rather than printing the id.

import { t, type Locale } from './i18n-ui';
import type { Grant, TeamOption } from '@/app/(app)/access/types';

export function grantSummary(
  g: Pick<Grant, 'kind' | 'config'>,
  locale: Locale,
  teams: TeamOption[] = [],
): string {
  const config = g.config ?? {};
  if (g.kind === 'circle') {
    return t(locale, 'circle_space_target', { ref: String(config.space_id ?? '—') });
  }
  if (g.kind === 'fibre_seat') {
    return t(locale, 'fibre_seat_target', { role: String(config.role ?? 'organiser') });
  }
  if (g.kind === 'google_user') return t(locale, 'google_account_target');
  if (g.kind === 'team_calendar') {
    const id = String(config.team_id ?? '');
    const team = teams.find((x) => x.id === id)?.name ?? t(locale, 'unknown_team');
    // Missing means 100 here for the same reason it does everywhere else:
    // the stored default is "included in the membership".
    const pct = config.discount_pct === undefined || config.discount_pct === null
      ? 100
      : Number(config.discount_pct);
    return pct === 100
      ? t(locale, 'team_calendar_target_free', { team })
      : t(locale, 'team_calendar_target_pct', { team, pct: String(pct) });
  }
  return t(locale, 'thread_target', { ref: String(config.thread_slug ?? '—') });
}
