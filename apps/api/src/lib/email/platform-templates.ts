// Platform lifecycle emails — not auth codes (auth-templates.ts), not Thread
// sends (thread-templates.ts). First resident: the access-approved welcome,
// which /request-access and /access-pending had been PROMISING since v0.14
// while nothing ever sent it.
//
// Same visual grammar as the auth emails: centred wordmark, one headline, one
// CTA, reassurance, footer. Copy reads from packages/shared/branding.ts.

import {
  APPS,
  BRAND_ASSETS,
  ENTITY,
  FOOTER_LINKS,
  PLATFORM_APP_ID,
  legalFooterLine,
} from '@thefibre/shared';
import { escapeHtml } from './templates.js';
import type { RenderedEmail } from './auth-templates.js';

const PLATFORM = APPS[PLATFORM_APP_ID];

export function renderWorkspaceReadyEmail(args: {
  fullName: string;
  workspaceName: string;
}): RenderedEmail {
  const signInUrl = `${PLATFORM.url}/sign-in`;
  const firstName = args.fullName.trim().split(/\s+/)[0] || 'there';
  const subject = `Your ${PLATFORM.name} workspace is ready`;

  const text = [
    PLATFORM.name,
    '',
    'Your workspace is ready',
    '',
    `Hi ${firstName} — your request for access has been approved, and a workspace`,
    `called "${args.workspaceName}" is waiting for you.`,
    '',
    'Sign in with this email address (Google or a one-time code both work):',
    signInUrl,
    '',
    'If you did not request access to The Fibre, you can ignore this email —',
    'nothing happens until you sign in.',
    '',
    '---',
    `Help: ${FOOTER_LINKS.help}   About us: ${FOOTER_LINKS.about}   Legal: ${FOOTER_LINKS.legal}   Privacy: ${FOOTER_LINKS.privacy}`,
    '',
    `To make sure our emails arrive, please add ${ENTITY.whitelistEmail} to your contacts.`,
    legalFooterLine(),
  ].join('\n');

  const html = `<!doctype html>
<html lang="en">
<body style="margin: 0; padding: 0; background: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #171717;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #ffffff;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 560px; padding: 48px 32px;">
        <tr><td align="center">
          <img src="${BRAND_ASSETS.logoUrl}" alt="${escapeHtml(BRAND_ASSETS.logoAlt)}" width="140" style="display: block; margin: 0 auto 48px; border: 0; outline: none; text-decoration: none; height: auto;" />

          <h1 style="margin: 0; font-size: 28px; font-weight: 500; letter-spacing: -0.01em; color: #171717;">
            Your workspace is ready
          </h1>

          <p style="margin: 24px 0 0; color: #525252; font-size: 15px; line-height: 1.5;">
            Hi ${escapeHtml(firstName)} — your request for access has been approved, and a
            workspace called <strong>${escapeHtml(args.workspaceName)}</strong> is waiting for you.
          </p>

          <p style="margin: 24px 0; text-align: center;">
            <a href="${escapeHtml(signInUrl)}"
               style="display: inline-block; background: #171717; color: #fff; text-decoration: none; font-size: 14px; font-weight: 500; padding: 12px 24px; border-radius: 8px;">
              Sign in
            </a>
          </p>

          <p style="margin: 0; color: #737373; font-size: 14px; text-align: center;">
            Use this email address — Google or a one-time code both work.
          </p>

          <p style="margin: 32px 0 0; color: #737373; font-size: 13px; line-height: 1.6; max-width: 440px;">
            If you did not request access to ${escapeHtml(PLATFORM.name)}, you can ignore this
            email — nothing happens until you sign in.${
              ENTITY.supportEmail
                ? ` Questions? Our friendly <a href="mailto:${escapeHtml(ENTITY.supportEmail)}" style="color: #525252;">support team</a> is always happy to help.`
                : ''
            }
          </p>

          <hr style="margin: 48px 0 24px; border: 0; border-top: 1px solid #e5e5e5;" />

          <p style="margin: 0; font-size: 13px; color: #737373;">
            <a href="${FOOTER_LINKS.help}" style="color: #525252; text-decoration: none;">Help</a>
            &nbsp;·&nbsp;
            <a href="${FOOTER_LINKS.about}" style="color: #525252; text-decoration: none;">About us</a>
            &nbsp;·&nbsp;
            <a href="${FOOTER_LINKS.legal}" style="color: #525252; text-decoration: none;">Legal</a>
            &nbsp;·&nbsp;
            <a href="${FOOTER_LINKS.privacy}" style="color: #525252; text-decoration: none;">Privacy</a>
          </p>

          <p style="margin: 16px 0 0; font-size: 12px; color: #a3a3a3;">
            To make sure our emails arrive, please add
            <a href="mailto:${escapeHtml(ENTITY.whitelistEmail)}" style="color: #737373;">${escapeHtml(ENTITY.whitelistEmail)}</a>
            to your contacts.
          </p>

          <p style="margin: 8px 0 0; font-size: 12px; color: #a3a3a3;">
            ${escapeHtml(legalFooterLine())}
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return { subject, text, html };
}
