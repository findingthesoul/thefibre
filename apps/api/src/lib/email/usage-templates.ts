// Usage + archive emails — the 80% meter warnings and the 13-month Free
// archive warning (P4, docs/productisation-proposal.md §4). Sent to workspace
// ADMINS by the billing meter tick (lib/usage-meters.ts), deduplicated by
// usage_warning / workspace.archive_warned_at, so each renders at most once
// per (workspace, meter, month).
//
// English-only for now: these go to workspace administrators, not end
// participants. Fold into platform-i18n.ts with the // MT burn-down when the
// admin surfaces get their i18n pass.

import { APPS, ENTITY, PLATFORM_APP_ID, legalFooterLine, BRAND_ASSETS } from '@thefibre/shared';
import { escapeHtml } from './templates.js';
import type { RenderedEmail } from './auth-templates.js';

const PLATFORM = APPS[PLATFORM_APP_ID];

/** The auth/platform emails' visual grammar, reduced to what these need. */
function shell(headline: string, bodyHtml: string, cta?: { label: string; url: string }): string {
  return `<!doctype html>
<html lang="en">
<body style="margin: 0; padding: 0; background: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #171717;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #ffffff;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 560px; padding: 48px 32px;">
        <tr><td align="center">
          <img src="${BRAND_ASSETS.logoUrl}" alt="${escapeHtml(BRAND_ASSETS.logoAlt)}" width="140" style="display: block; margin: 0 auto 48px; border: 0; outline: none; text-decoration: none; height: auto;" />
          <h1 style="margin: 0; font-size: 26px; font-weight: 500; letter-spacing: -0.01em; color: #171717;">
            ${escapeHtml(headline)}
          </h1>
          <p style="margin: 24px 0 0; color: #525252; font-size: 15px; line-height: 1.6; text-align: left;">
            ${bodyHtml}
          </p>
          ${
            cta
              ? `<p style="margin: 24px 0; text-align: center;">
            <a href="${escapeHtml(cta.url)}"
               style="display: inline-block; background: #171717; color: #fff; text-decoration: none; font-size: 14px; font-weight: 500; padding: 12px 24px; border-radius: 8px;">
              ${escapeHtml(cta.label)}
            </a>
          </p>`
              : ''
          }
          <hr style="margin: 48px 0 24px; border: 0; border-top: 1px solid #e5e5e5;" />
          <p style="margin: 0; font-size: 12px; color: #a3a3a3;">
            Questions? ${escapeHtml(ENTITY.supportEmail ?? ENTITY.whitelistEmail)} · ${escapeHtml(legalFooterLine())}
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

const METER_NOUN: Record<'emails' | 'storage', string> = {
  emails: 'email',
  storage: 'storage',
};

/**
 * The 80% crossing. Names the numbers, says plainly what happens next — which
 * depends on whether the plan bills overage (unit price set) or the allowance
 * is soft (nothing set → nothing happens, and the email says so).
 */
export function renderUsageWarningEmail(args: {
  workspaceName: string;
  meter: 'emails' | 'storage';
  /** Already formatted for humans — "8,120 emails", "4.2 GB". */
  usedLabel: string;
  allowanceLabel: string;
  /** "€1.00 per 1,000 emails over" — null when overage is not billed. */
  overagePriceLine: string | null;
}): RenderedEmail {
  const noun = METER_NOUN[args.meter];
  const subject = `${args.workspaceName}: over 80% of your ${noun} allowance used`;
  const planUrl = `${PLATFORM.url}/settings/plan`;
  const consequence = args.overagePriceLine
    ? `Anything past the allowance is billed on your next invoice at ${args.overagePriceLine}.`
    : `Nothing past the allowance is billed and nothing stops working — but a bigger plan may fit better.`;

  const text = [
    PLATFORM.name,
    '',
    `Your workspace "${args.workspaceName}" has used ${args.usedLabel} of its ${args.allowanceLabel} ${noun} allowance this month — past 80%.`,
    '',
    consequence,
    '',
    `See the meters and the other plans: ${planUrl}`,
    '',
    '---',
    legalFooterLine(),
  ].join('\n');

  const html = shell(
    `Past 80% of your ${noun} allowance`,
    `Your workspace <strong>${escapeHtml(args.workspaceName)}</strong> has used <strong>${escapeHtml(
      args.usedLabel,
    )}</strong> of its ${escapeHtml(args.allowanceLabel)} ${escapeHtml(noun)} allowance this month.<br /><br />${escapeHtml(consequence)}`,
    { label: 'See your plan', url: planUrl },
  );

  return { subject, text, html };
}

/**
 * The 12-months-inactive warning to a Free workspace, one month before the
 * archive. Says what "inactive" meant, what will happen, that nothing is
 * deleted, and where the data can be taken out first.
 */
export function renderInactivityWarningEmail(args: {
  workspaceName: string;
  lastActiveOn: string; // "14 September 2025"
  archivesOn: string; // "6 October 2026"
}): RenderedEmail {
  const subject = `${args.workspaceName} will be archived on ${args.archivesOn} — sign in to keep it active`;
  const signInUrl = `${PLATFORM.url}/sign-in`;
  const privacyUrl = `${PLATFORM.url}/privacy`;

  const text = [
    PLATFORM.name,
    '',
    `Your free workspace "${args.workspaceName}" has seen no sign-ins or activity since ${args.lastActiveOn}.`,
    '',
    `Free workspaces inactive for 13 months are archived. Archiving is a pause, not a deletion: every contact, event and record stays exactly as it is, and one click reactivates the workspace at any time.`,
    '',
    `If you still use it: simply sign in before ${args.archivesOn} and nothing happens.`,
    signInUrl,
    '',
    `If you're done with it: you can take a copy of your data first — the Privacy page (${privacyUrl}) covers your data rights, or write to ${ENTITY.supportEmail ?? ENTITY.whitelistEmail} for a full export.`,
    '',
    '---',
    legalFooterLine(),
  ].join('\n');

  const html = shell(
    'Your workspace is about to be archived',
    `Your free workspace <strong>${escapeHtml(args.workspaceName)}</strong> has seen no sign-ins or activity since ${escapeHtml(
      args.lastActiveOn,
    )}. Free workspaces inactive for 13 months are archived on ${escapeHtml(
      args.archivesOn,
    )}.<br /><br />Archiving is a pause, not a deletion: every contact, event and record stays exactly as it is, and one click brings the workspace back at any time.<br /><br />If you still use it, simply sign in before then and nothing happens. If you're done with it, you can take a copy of your data first — the <a href="${escapeHtml(
      privacyUrl,
    )}" style="color: #525252;">Privacy page</a> covers your data rights, or write to <a href="mailto:${escapeHtml(
      ENTITY.supportEmail ?? ENTITY.whitelistEmail,
    )}" style="color: #525252;">${escapeHtml(ENTITY.supportEmail ?? ENTITY.whitelistEmail)}</a> for a full export.`,
    { label: 'Sign in to keep it active', url: signInUrl },
  );

  return { subject, text, html };
}
