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
export const STANDARD_TERMS_VERSION = 'standard-terms-v1-draft';

/** Where the standard terms live, per environment. The marketing site serves
 *  them: they are a public document a stranger reads before paying, not an
 *  app page behind a sign-in. */
export function standardTermsUrl(env: NodeJS.ProcessEnv = process.env): string {
  // The same switch the rest of the platform uses: staging is the .tech twin.
  const base = env.NEXT_PUBLIC_WEBSITE_URL ?? env.WEBSITE_URL ?? '';
  if (base) return `${base.replace(/\/$/, '')}/terms/standard`;
  return env.FIBRE_ENV === 'staging'
    ? 'https://thefibre.tech/terms/standard'
    : 'https://thethread.app/terms/standard';
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
