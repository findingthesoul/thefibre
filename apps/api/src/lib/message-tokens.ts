// The tokens an organiser can type into a thread message.
//
// Sjoerd, 2026-09-24: *"add {my.thread} as a link to the my.thethread.app in
// the text fields"* — a participant reading a message should be able to get
// to their own page without being told where to look for it.
//
// WHY THIS FILE EXISTS AT ALL
// ---------------------------------------------------------------------------
// There were two token maps, not one: `sendTriggeredMessages` (enrolment,
// approval, completion) and `runThreadMessageScheduler` (the 5-minute job
// that sends everything dated or relative). They were written at different
// times and had already drifted — the scheduler's map was missing
// `{start_date}`, so a message scheduled for "7 days before the start" mailed
// participants the literal text `{start_date}`.
//
// That drift is why this is a module and not one more entry in each map. A
// new token added to one of two copies is a token that works when you test it
// by hand — triggers fire immediately — and fails silently on the path that
// does most of the sending. The scheduler gains `{start_date}` here as a
// consequence, which is a fix, not a side effect worth hiding.
//
// WHY {my.thread} IS EXPANDED TO A URL AND NOT TO MARKUP
// ---------------------------------------------------------------------------
// A message body makes exactly one trip: rich text → `stripHtml` → token
// substitution → `escapeHtml` into a `white-space:pre-wrap` div. Everything
// an organiser types is escaped on purpose, so that an organiser — or an app
// writing an engagement through the published contract — cannot inject markup
// into mail sent from the platform's own domain (docs/brief-thread-
// engagements-from-apps.md §"Token substitution stays server-side").
//
// So the token expands to a plain URL, in the subject and in both body parts,
// and `engagementMessage` turns that one known URL into an anchor AFTER
// escaping. The rule stays "organiser text is never markup"; the only thing
// that becomes a link is a string this file put there.
//
// The address is the portal's front door, not a per-person magic link. The
// portal signs people in with Google or an 8-digit code, and a link that
// carried a session would be a credential sitting in an inbox and in every
// forward of it.

import { surfaceUrl } from '@thefibre/shared';

/** The token an organiser types. A dot, not an underscore — Sjoerd's
 *  spelling, and it reads as the product's name rather than a variable.
 *  Substitution is `replaceAll` on a literal string, so the dot is inert;
 *  note that the CERTIFICATE builder's separate `\{(\w+)\}` regex would not
 *  match it, which is why this token is not offered there. */
export const MY_THREAD_TOKEN = '{my.thread}';

/** Emails want an absolute production URL, so no `host` argument — see the
 *  doc comment on `surfaceUrl`. On staging this resolves through
 *  NEXT_PUBLIC_MY_URL, which is why that variable is load-bearing on the
 *  staging API and not merely nice to have. */
export function myThreadUrl(env: Record<string, string | undefined> = process.env): string {
  return surfaceUrl('my-portal', env);
}

export function messageTokens(opts: {
  /** The participant's full name, or their email if we have no name. */
  name: string;
  /** Their first name, when the caller already knows it. */
  firstName?: string | null;
  threadTitle: string;
  organiserName: string;
  /** Either a date to format, or an already-formatted label. */
  startsOn?: string | null;
  dateLabel?: string | null;
  env?: Record<string, string | undefined>;
}): Record<string, string> {
  const date =
    opts.dateLabel ??
    (opts.startsOn
      ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(
          new Date(opts.startsOn),
        )
      : '');
  return {
    '{name}': opts.firstName || (opts.name.split(/\s+/)[0] ?? opts.name),
    '{thread}': opts.threadTitle,
    '{organiser}': opts.organiserName,
    '{date}': date,
    // Same value, two names: {start_date} reads better in a sentence somebody
    // is writing by hand, and is the one Sjoerd reached for unprompted.
    '{start_date}': date,
    [MY_THREAD_TOKEN]: myThreadUrl(opts.env),
  };
}

export function substituteTokens(s: string, tokens: Record<string, string>): string {
  return Object.entries(tokens).reduce((acc, [k, v]) => acc.replaceAll(k, v), s);
}
