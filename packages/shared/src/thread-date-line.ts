// One way for ANY app to print a thread's dates: through the shared rule
// (cardDateLine in ./thread-dates), in a given language and the thread's
// zone. Used by Thread (organiser list, organiser pages, thread page, embed)
// and my.thread (thread detail, Upcoming) — one helper, not one per app.
//
// Thread dates slice 4 (2026-10-16). Until then the organiser grid, the
// public thread page, the single-thread embed and the organiser's own list
// each carried a private fmtDates — the program period only, and always in
// en-GB whatever language the thread was in — while the embed cards had moved
// to key moments and the workspace's card choice. Two answers to "when is
// this thread", depending on where you looked.
//
// A CARD passes the workspace's choice (card_dates). A PAGE passes
// PAGE_DATES: the key-moment span and the count, because the workspace's
// choice is about cards and the page has its own place for when sign-ups
// close.

import { INTL_LOCALES, isLocale } from './i18n.js';
import { cardDateLine, type CardDates } from './thread-dates.js';

export const PAGE_DATES: CardDates = { range: 'event', sessions: true, signup_by: false };
/** The organiser's own list: the thread period (their working window), with
 *  the count and the close date, so the effect of key moments and a close
 *  session shows where they manage their threads. */
export const ORGANISER_DATES: CardDates = { range: 'thread', sessions: true, signup_by: true };

export type DatedThread = {
  starts_on: string | null;
  ends_on: string | null;
  event_starts_at?: string | null;
  event_ends_at?: string | null;
  key_moment_count?: number | null;
  signups_close_at?: string | null;
};

export function threadDateLine(
  item: DatedThread,
  choice: CardDates,
  where: { language?: string | null; timezone?: string | null },
): string | null {
  const locale = where.language && isLocale(where.language) ? where.language : 'en';
  return cardDateLine(item, choice, {
    locale,
    intlLocale: INTL_LOCALES[locale],
    timeZone: where.timezone || 'Europe/Amsterdam',
  });
}
