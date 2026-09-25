// Which of the family's apps this person can actually walk into.
//
// Sjoerd, 2026-09-25, after Debbie could not: *"maybe it's better to — for
// threadapp users — have a hamburger right top, with the switch to different
// apps."*
//
// WHAT THIS IS NOT. It did not help Debbie and nothing here would have: she
// has no `user` row anywhere, only two `person` rows. She is a community
// member, so this list is empty for her and the switcher does not appear. Her
// problem was that the portal's only way out led to the marketing homepage
// and nothing said why — that is fixed separately, in words.
//
// Who it IS for: the people who are BOTH. Somebody who runs programmes and is
// also enrolled in someone else's lands on this page with no way through to
// their own work, and the portal deliberately has no workspace chrome to
// carry them there.
//
// THE CLAIM IS THE SOURCE. `app_memberships` is minted into the JWT by the
// access-token hook, so this costs no call and cannot disagree with what the
// API would enforce — it IS what the API enforces. The portal has no
// workspace context of its own and could not have asked.

import { APP_DISPLAY_ORDER, APP_IDS, APPS, appUrl, type AppId } from '@thefibre/shared';
import { serverSupabase } from './supabase/server';

export type ReachableApp = { slug: AppId; name: string; url: string };

/**
 * Empty for a participant, which is almost everybody here.
 *
 * Links are plain absolute URLs rather than the apps' own `/sso/hop` form:
 * that path is served BY an app, and the portal is a surface with no such
 * route to offer. Same-apex targets carry the session on the shared cookie
 * and land signed in; the platform sits on the other apex and will ask them
 * to continue there. Worth knowing before somebody reports the second as a
 * bug — it is one click, not a dead end.
 */
export async function reachableApps(host: string | null): Promise<ReachableApp[]> {
  const supabase = await serverSupabase();
  const { data } = await supabase.auth.getClaims();
  const raw = (data?.claims as { app_memberships?: unknown } | undefined)?.app_memberships;
  if (!Array.isArray(raw)) return [];

  const held = new Set(raw.filter((s): s is string => typeof s === 'string'));

  return APP_DISPLAY_ORDER.filter(
    (slug): slug is AppId =>
      // Both halves matter: a slug we do not know about would crash on
      // APPS[slug], and a slug they do not hold is not theirs to be offered.
      (APP_IDS as readonly string[]).includes(slug) && held.has(slug),
  )
    .filter((slug) => APPS[slug].available !== false)
    .map((slug) => ({ slug, name: APPS[slug].shortName ?? APPS[slug].name, url: appUrl(slug, process.env, host) }));
}
