// Which terms a member is agreeing to, and how that agreement is recorded.
//
// The agreement is between the WORKSPACE and its member. The Thread is the
// software underneath and not a party to it — which is why the standard text
// exists at all: a workspace that has never written terms still needs
// something reasonable to put in front of somebody before taking their money,
// and that something must say whose agreement it is.
//
// One function decides the URL and one decides the version, because the
// version is what the consent record stores: "they accepted THESE words".
// When the standard terms are rewritten, the version changes, and the
// one-live-per-version index lets the new acceptance be recorded beside the
// old one instead of silently colliding with it.

/** The standard terms' version. Bump it when the words change — the consent
 *  record stores this, and an old acceptance must stay readable as an
 *  acceptance of the OLD words. */
import { appUrl, stagingAppUrl, PLATFORM_APP_ID } from '@thefibre/shared';

// APPROVED 2026-10-14. The words are unchanged from the draft; what changed
// is that they are no longer provisional, and that makes this a DIFFERENT
// version string from the one earlier acceptances carry — which is the point.
// The consent index keys on `text_version`, so `standard-terms-v1` is
// recordable BESIDE `standard-terms-v1-draft` rather than colliding with it,
// and somebody who agreed to the draft keeps a record saying exactly that.
// No existing row is rewritten: a consent is evidence of what somebody was
// shown, and evidence is not edited.
export const STANDARD_TERMS_VERSION = 'standard-terms-v1';

/** Where the standard terms live. The marketing site serves them: a public
 *  document a stranger reads before paying, not an app page behind a sign-in.
 *
 *  DERIVED, NEVER TYPED. The first version of this hand-wrote both hosts and
 *  branched on an env var that does not exist (`FIBRE_ENV`), so the DEPLOYED
 *  staging API answered `https://thethread.app/terms/standard` — a staging
 *  joiner would have been shown production's page. The unit test passed,
 *  because it fed the env in by hand.
 *
 *  This repo has had that exact bug twice before, and `stagingSurfaceUrl`
 *  carries the note: "the first caller without one was the API, building a
 *  calendar subscription address, and it handed out a PRODUCTION URL from the
 *  staging stack." The signal the API already uses to know which stack it is
 *  on is FLY_APP_NAME (lib/cors-origins.ts), so this uses the same one.
 *
 *  AND IT POINTS AT THE PLATFORM APP, not the marketing site. The second
 *  version pointed at `website`, which has no staging deployment — so the link
 *  404'd on BOTH stacks (Sjoerd: "Terms and condition link leads to nothing").
 *  apps/web answers on thefibre.tech and thefibre.app alike and already serves
 *  /terms and /privacy-policy, so the document is reachable wherever a join
 *  happens. */
export function standardTermsUrl(env: NodeJS.ProcessEnv = process.env): string {
  const base =
    env.FLY_APP_NAME === 'thefibre-api-staging'
      ? stagingAppUrl(PLATFORM_APP_ID)
      : appUrl(PLATFORM_APP_ID, env as Record<string, string | undefined>);
  return `${base.replace(/\/$/, '')}/terms/standard`;
}

export type ResolvedTerms = {
  /** What the member clicks. */
  url: string;
  /** What the consent record stores, so "which words" is answerable later. */
  version: string;
  /** Whether these are the workspace's own terms or the standard ones — the
   *  join form says so, because "our terms" and "the platform's standard
   *  terms" are different promises and a member should know which they are
   *  agreeing to. */
  standard: boolean;
};

/**
 * The terms for a workspace: its own if it set one, the standard otherwise.
 *
 * A workspace's own URL is stored as given. Its VERSION is the URL itself —
 * we cannot know when somebody edits a page we do not host, so the honest
 * record is "they accepted what was at this address on this date". The
 * standard terms carry a real version because we control the text.
 */
export function resolveTerms(
  workspaceTermsUrl: string | null | undefined,
  env: NodeJS.ProcessEnv = process.env,
): ResolvedTerms {
  const own = (workspaceTermsUrl ?? '').trim();
  if (own) return { url: own, version: own, standard: false };
  return { url: standardTermsUrl(env), version: STANDARD_TERMS_VERSION, standard: true };
}
