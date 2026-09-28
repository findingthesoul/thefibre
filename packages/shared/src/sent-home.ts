// Where an app sends you when it cannot serve you, and what it says there.
//
// Sjoerd, 2026-09-28: *"In any other case of an error or mistake, go back to
// the fibre, but never switch workspace automatically."* And: *"Back to fibre
// — but a comment in a popup."*
//
// Before this, seven apps each did `redirect('/no-access')` into a wall with
// a switch button on it. The wall was honest but it left you standing in an
// app that cannot serve you, and the switch on it moved your workspace —
// which is the thing that must only ever happen because you asked for it.
//
// So: the app hands you back to The Fibre, which is the one place that always
// works, and The Fibre explains what happened in a popup. The workspace is
// untouched. Nothing about where you are changes except that you are now
// somewhere that works.
//
// The reason travels as query parameters rather than a session flag, because
// the hop crosses apexes (thethread.app → thefibre.app) and a cookie set on
// one is not readable on the other. They are display-only — The Fibre shows
// what it is told and grants nothing on the strength of it.

import { appUrl } from './index.js';

/** Why an app handed somebody back. Extend deliberately: every value needs a
 *  sentence in the popup catalogue. */
export type SentHomeReason =
  /** The workspace you are in does not run this app, or you hold no seat in it. */
  | 'no-access'
  /** The app could not load who you are at all. */
  | 'no-session';

export type SentHomeParams = {
  reason: SentHomeReason;
  /** The app that could not serve you — its slug, resolved to a name by the
   *  receiver from the shared registry, so a rename stays a one-file change. */
  from: string;
  /** The workspace you were standing in, by name. Display only. */
  workspace?: string | null;
};

/**
 * The Fibre URL to send somebody to, carrying the explanation.
 *
 * `env` and `host` are required for the same reason they are everywhere else
 * in this package: without them a staging deployment sends people to
 * production (see appUrl).
 */
export function sentHomeUrl(
  params: SentHomeParams,
  env: Record<string, string | undefined>,
  host?: string | null,
): string {
  const base = appUrl('fibre-platform', env, host);
  const q = new URLSearchParams({ sent_home: params.reason, from: params.from });
  if (params.workspace) q.set('in', params.workspace);
  return `${base}/dashboard?${q.toString()}`;
}

/** Read the explanation back off a URL. Returns null when there is none —
 *  the ordinary case for every normal visit. */
export function readSentHome(search: {
  sent_home?: string | string[];
  from?: string | string[];
  in?: string | string[];
}): SentHomeParams | null {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const reason = one(search.sent_home);
  const from = one(search.from);
  if (reason !== 'no-access' && reason !== 'no-session') return null;
  if (!from) return null;
  return { reason, from, workspace: one(search.in) ?? null };
}
