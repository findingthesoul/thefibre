// The words the shared TeamCalendarGrantFields needs, from THIS app's
// catalogue.
//
// The component holds no English — a shared component that did would be one
// an app with another vocabulary could not use (brand-design: definitions in
// shared, words injected). Both surfaces that render it, the product dialog
// and the legacy tier Access dialog, go through here, so "100% — free for
// members" is one sentence in one place.

import type { TeamCalendarLabels } from '@thefibre/shared/ui/team-calendar-grant';
import { t, type Locale } from './i18n-ui';

export function teamCalendarLabels(locale: Locale): TeamCalendarLabels {
  return {
    team: t(locale, 'team_label'),
    teamPlaceholder: t(locale, 'pick_team_ph'),
    pct: t(locale, 'member_discount_label'),
    freeHint: t(locale, 'pct_free_hint'),
    partialHint: (pct: number) => t(locale, 'pct_partial_hint', { pct: String(pct) }),
    zeroHint: t(locale, 'pct_zero_hint'),
    rangeHint: t(locale, 'pct_range_hint'),
    unpublishedHint: t(locale, 'team_unpublished_hint'),
    unpublishedTag: t(locale, 'team_unpublished_tag'),
  };
}
