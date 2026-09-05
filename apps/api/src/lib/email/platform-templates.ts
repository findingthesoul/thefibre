// Platform lifecycle emails — not auth codes (auth-templates.ts), not Thread
// sends (thread-templates.ts). First resident: the access-approved welcome,
// which /request-access and /access-pending had been PROMISING since v0.14
// while nothing ever sent it.
//
// Same visual grammar as the auth emails: centred wordmark, one headline, one
// CTA, reassurance, footer. Copy reads from packages/shared/branding.ts —
// and, since i18n P2, from the six-locale catalog in platform-i18n.ts.
// Callers resolve the recipient's locale via platformEmailLocale(email)
// (chain: identity_profile.locale → 'en') and pass it in; omitted = English,
// so existing call sites keep working unchanged.

import {
  APPS,
  BRAND_ASSETS,
  ENTITY,
  FOOTER_LINKS,
  PLATFORM_APP_ID,
  legalFooterLine,
  toLocale,
} from '@thefibre/shared';
import { escapeHtml } from './templates.js';
import type { RenderedEmail } from './auth-templates.js';
import { platformT as t } from './platform-i18n.js';

const PLATFORM = APPS[PLATFORM_APP_ID];

/**
 * HTML-fill: escape the raw catalog entry FIRST, then substitute vars whose
 * values are already escaped (and may carry markup like <strong> or <a>).
 * Braces survive escapeHtml, so {placeholders} are still there to replace.
 */
function htmlFill(raw: string, vars: Record<string, string>): string {
  let s = escapeHtml(raw);
  for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, v);
  return s;
}

export function renderWorkspaceReadyEmail(args: {
  fullName: string;
  workspaceName: string;
  /** Paid package picked on the request form — names where to activate it. */
  desiredPlanName?: string | null;
  /** From platformEmailLocale(recipient email); omitted/unknown → en. */
  locale?: string | null;
}): RenderedEmail {
  const L = toLocale(args.locale);
  const signInUrl = `${PLATFORM.url}/sign-in`;
  const firstName = args.fullName.trim().split(/\s+/)[0] || '';
  const subject = t(L, 'ws_subject', { platform: PLATFORM.name });
  const introKey = firstName ? 'ws_intro' : 'ws_intro_no_name';
  const planLine = args.desiredPlanName
    ? t(L, 'ws_plan_line', { plan: args.desiredPlanName })
    : null;

  const text = [
    PLATFORM.name,
    '',
    t(L, 'ws_headline'),
    '',
    t(L, introKey, { name: firstName, workspace: `"${args.workspaceName}"` }),
    '',
    t(L, 'ws_signin_line'),
    signInUrl,
    ...(planLine ? ['', planLine] : []),
    '',
    t(L, 'ws_ignore', { platform: PLATFORM.name }),
    '',
    '---',
    `${t(L, 'footer_help')}: ${FOOTER_LINKS.help}   ${t(L, 'footer_about')}: ${FOOTER_LINKS.about}   ${t(L, 'footer_legal')}: ${FOOTER_LINKS.legal}   ${t(L, 'footer_privacy')}: ${FOOTER_LINKS.privacy}`,
    '',
    t(L, 'ws_whitelist', { email: ENTITY.whitelistEmail }),
    legalFooterLine(),
  ].join('\n');

  // Raw entries (no vars) feed htmlFill so substituted values can carry markup.
  const introHtml = htmlFill(t(L, introKey), {
    name: escapeHtml(firstName),
    workspace: `<strong>${escapeHtml(args.workspaceName)}</strong>`,
  });
  const supportHtml = ENTITY.supportEmail
    ? ' ' +
      htmlFill(t(L, 'ws_support'), {
        support_team: `<a href="mailto:${escapeHtml(ENTITY.supportEmail)}" style="color: #525252;">${escapeHtml(t(L, 'ws_support_team'))}</a>`,
      })
    : '';

  const html = `<!doctype html>
<html lang="${L}">
<body style="margin: 0; padding: 0; background: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #171717;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #ffffff;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 560px; padding: 48px 32px;">
        <tr><td align="center">
          <img src="${BRAND_ASSETS.logoUrl}" alt="${escapeHtml(BRAND_ASSETS.logoAlt)}" width="140" style="display: block; margin: 0 auto 48px; border: 0; outline: none; text-decoration: none; height: auto;" />

          <h1 style="margin: 0; font-size: 28px; font-weight: 500; letter-spacing: -0.01em; color: #171717;">
            ${escapeHtml(t(L, 'ws_headline'))}
          </h1>

          <p style="margin: 24px 0 0; color: #525252; font-size: 15px; line-height: 1.5;">
            ${introHtml}
          </p>

          <p style="margin: 24px 0; text-align: center;">
            <a href="${escapeHtml(signInUrl)}"
               style="display: inline-block; background: #171717; color: #fff; text-decoration: none; font-size: 14px; font-weight: 500; padding: 12px 24px; border-radius: 8px;">
              ${escapeHtml(t(L, 'ws_button'))}
            </a>
          </p>

          <p style="margin: 0; color: #737373; font-size: 14px; text-align: center;">
            ${escapeHtml(t(L, 'ws_use_email'))}
          </p>

          ${
            planLine
              ? `<p style="margin: 24px 0 0; color: #525252; font-size: 15px; line-height: 1.5;">${escapeHtml(planLine)}</p>`
              : ''
          }

          <p style="margin: 32px 0 0; color: #737373; font-size: 13px; line-height: 1.6; max-width: 440px;">
            ${htmlFill(t(L, 'ws_ignore'), { platform: escapeHtml(PLATFORM.name) })}${supportHtml}
          </p>

          <hr style="margin: 48px 0 24px; border: 0; border-top: 1px solid #e5e5e5;" />

          <p style="margin: 0; font-size: 13px; color: #737373;">
            <a href="${FOOTER_LINKS.help}" style="color: #525252; text-decoration: none;">${escapeHtml(t(L, 'footer_help'))}</a>
            &nbsp;·&nbsp;
            <a href="${FOOTER_LINKS.about}" style="color: #525252; text-decoration: none;">${escapeHtml(t(L, 'footer_about'))}</a>
            &nbsp;·&nbsp;
            <a href="${FOOTER_LINKS.legal}" style="color: #525252; text-decoration: none;">${escapeHtml(t(L, 'footer_legal'))}</a>
            &nbsp;·&nbsp;
            <a href="${FOOTER_LINKS.privacy}" style="color: #525252; text-decoration: none;">${escapeHtml(t(L, 'footer_privacy'))}</a>
          </p>

          <p style="margin: 16px 0 0; font-size: 12px; color: #a3a3a3;">
            ${htmlFill(t(L, 'ws_whitelist'), {
              email: `<a href="mailto:${escapeHtml(ENTITY.whitelistEmail)}" style="color: #737373;">${escapeHtml(ENTITY.whitelistEmail)}</a>`,
            })}
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
