// Marking mail that is not real.
//
// Sjoerd, holding a sandbox receipt from the staging stack: *"Is this a test
// or is it real?"* He could not tell, and neither could I — staging is a
// perfect copy, so a staging receipt is byte-for-byte a production receipt
// with different numbers in it. The blue bar solved this for PAGES
// (packages/shared/src/ui/environment-bar.tsx); mail leaves the building and
// arrives in the same inbox as the real thing, with no bar and no address
// bar to check.
//
// WHICH ENVIRONMENT, and why the default is the OPPOSITE of the bar's
// ────────────────────────────────────────────────────────────────────
// The bar treats anything that is not positively production as staging:
// unknown means show the bar, because the expensive mistake there is a blue
// line across the real product, and `VERCEL_ENV=production` is guaranteed on
// Vercel, so "unknown" never happens where it would cost anything.
//
// Here the expensive mistake is sharper and it is somebody else's. A
// `[STAGING]` prefix on a real customer's receipt is not cosmetic — it tells
// a paying person their transaction may not have happened. So this asks
// POSITIVELY whether it is the staging API, and marks nothing otherwise. The
// reasoning is the bar's; the default comes out the other way because the
// cost does.
//
// `FLY_APP_NAME` is the signal the API already uses to know which stack it is
// (lib/cors-origins.ts, which grants staging origins on exactly this test).
// Using it again keeps one definition rather than inventing a second one that
// a rename could silently break in only one of the two places.
//
// THE GAP, stated rather than hidden: mail from a LOCAL dev server is not
// marked, because off Fly `FLY_APP_NAME` is empty and empty is not positively
// staging. In practice local dev has no `RESEND_API_KEY` and sends nothing —
// sendEmail logs instead. A developer who sets a real key locally gets
// unmarked mail, and widening the rule to cover them would mean marking on
// "not positively production", which is the one thing the paragraph above
// refuses to do.

/** The Fly app that serves production. Anything else is not it. */
const PRODUCTION_APP = 'thefibre-api';
/** The Fly app that serves staging — fly.staging.toml. */
const STAGING_APP = 'thefibre-api-staging';

export const TEST_SUBJECT_PREFIX = '[STAGING] ';

const BANNER_TEXT = 'Test email from the staging environment — not a real transaction.';

/**
 * Is this deployment one whose mail must be marked?
 *
 * Exported and pure so the thing worth asserting can be asserted: that
 * production answers false, that it answers false even if somebody renames
 * the staging app, and that it answers false off Fly.
 */
export function marksMailAsTest(env: NodeJS.ProcessEnv | Record<string, string | undefined>): boolean {
  return env.FLY_APP_NAME === STAGING_APP;
}

/** True only for the production API. Separate from the above on purpose:
 *  "not production" and "is staging" are different questions, and conflating
 *  them is how a third environment would quietly inherit a default. */
export function isProductionApi(
  env: NodeJS.ProcessEnv | Record<string, string | undefined>,
): boolean {
  return env.FLY_APP_NAME === PRODUCTION_APP;
}

/** Prefixed once. A retry that re-marks an already-marked subject would stack
 *  prefixes, which looks like a bug in the product rather than a label. */
export function markSubject(subject: string): string {
  return subject.startsWith(TEST_SUBJECT_PREFIX) ? subject : TEST_SUBJECT_PREFIX + subject;
}

/**
 * A thin band at the very top of the message.
 *
 * INSIDE `<body>`, not before `<html>`. Content outside the document is at
 * the mercy of whatever each client's sanitiser does with it, and the one
 * place this must not be dropped is the client somebody is squinting at while
 * asking whether the email is real. Every template in this folder renders a
 * `<body ...>` tag; if one ever does not, the banner goes first and still
 * arrives.
 *
 * Inline styles only, and no colour token: this is email, where a stylesheet
 * is a suggestion. Amber rather than red — it is a label, not an error.
 */
export function markHtml(html: string): string {
  if (html.includes('data-test-banner')) return html;
  const banner =
    '<div data-test-banner style="margin: 0; padding: 10px 16px; background: #fef3c7; ' +
    'border-bottom: 1px solid #f59e0b; color: #78350f; font-family: -apple-system, ' +
    "BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 13px; " +
    `line-height: 1.4;">${BANNER_TEXT}</div>`;
  const bodyOpen = html.match(/<body\b[^>]*>/i);
  if (!bodyOpen || bodyOpen.index === undefined) return banner + html;
  const at = bodyOpen.index + bodyOpen[0].length;
  return html.slice(0, at) + banner + html.slice(at);
}

/**
 * The same sentence in the plain-text part.
 *
 * Not in the original ask, and included because leaving it out would make the
 * marking depend on which half of a multipart message the reader's client
 * chooses to show. A text-only client would get an unmarked test email, which
 * is the exact question being answered.
 */
export function markText(text: string): string {
  return text.startsWith(BANNER_TEXT) ? text : `${BANNER_TEXT}\n\n${text}`;
}
