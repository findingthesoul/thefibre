// Auth emails rendered by The Fibre API and sent via Resend. Triggered
// by the Supabase Auth "Send Email" webhook (apps/api/src/routes/auth-hook.ts).
//
// Visual identity follows the Thread reference: centred platform mark, big
// "Almost there"-style headline, a single prominent code box, a reassurance
// paragraph, a divider, and a footer with Help / About / Legal links plus a
// whitelist hint and the legal address line.
//
// All copy reads from packages/shared/src/branding.ts so a rename or
// white-label propagates without touching this file.

import {
  APPS,
  BRAND_ASSETS,
  ENTITY,
  FOOTER_LINKS,
  PLATFORM_APP_ID,
  legalFooterLine,
} from '@thefibre/shared';

const PLATFORM = APPS[PLATFORM_APP_ID];

type AuthEmailActionType =
  | 'signup'
  | 'login'
  | 'magiclink'
  | 'invite'
  | 'recovery'
  | 'email_change_new'
  | 'email_change_current'
  | 'reauthentication';

type RenderArgs = {
  email: string;
  /** 6-digit one-time code (when present). */
  token: string | null;
  /** Magic-link URL fallback (when present). */
  confirmationUrl: string | null;
  /** Validity window for the code, in minutes. Supabase default: 60. */
  validityMinutes: number;
};

export type RenderedEmail = { subject: string; text: string; html: string };

export function renderAuthEmail(
  action: AuthEmailActionType,
  args: RenderArgs,
): RenderedEmail {
  const copy = COPY[action] ?? COPY.magiclink;
  const subject = copy.subject;
  const text = buildText({ args, copy });
  const html = buildHtml({ args, copy });
  return { subject, text, html };
}

// ---------------------------------------------------------------------------
// Copy per action type
// ---------------------------------------------------------------------------

type Copy = {
  subject: string;
  /** Big headline at the top of the body. */
  headline: string;
  /** One-sentence intro above the code box. */
  intro: string;
  /** Optional CTA button label. Shown only when confirmationUrl is present. */
  cta?: string;
  /** Reassurance line below the code. */
  reassurance: string;
};

const COPY: Record<AuthEmailActionType, Copy> = {
  signup: {
    subject: `Confirm your ${PLATFORM.name} account`,
    headline: 'Almost there',
    intro: 'Enter this code to confirm your account:',
    cta: 'Confirm account',
    reassurance:
      "If you didn't sign up for an account, ignore this email — no account will be created.",
  },
  login: {
    subject: `Sign in to ${PLATFORM.name}`,
    headline: 'Almost there',
    intro: 'Here is your sign-in code:',
    cta: 'Sign in with one click',
    reassurance:
      "If you didn't try to sign in, ignore this email — someone may have typed your address by accident.",
  },
  magiclink: {
    subject: `Sign in to ${PLATFORM.name}`,
    headline: 'Almost there',
    intro: 'Here is your sign-in code:',
    cta: 'Sign in with one click',
    reassurance:
      "If you didn't try to sign in, ignore this email — someone may have typed your address by accident.",
  },
  invite: {
    subject: `You've been invited to ${PLATFORM.name}`,
    headline: "You've been invited",
    intro: 'Enter this code to accept the invitation:',
    cta: 'Accept invitation',
    reassurance:
      "If you weren't expecting this, ignore the email — no account will be created.",
  },
  recovery: {
    subject: `Reset your ${PLATFORM.name} password`,
    headline: 'Reset your password',
    intro: 'Use this code to confirm a password reset:',
    cta: 'Reset password',
    reassurance:
      "If you didn't request a reset, ignore this email — your password will not change.",
  },
  email_change_new: {
    subject: `Confirm your new ${PLATFORM.name} email`,
    headline: 'Confirm your new email',
    intro: 'Enter this code on the address you want to use from now on:',
    cta: 'Confirm new email',
    reassurance:
      "If you didn't request this change, ignore the email and your address stays as it is.",
  },
  email_change_current: {
    subject: `Confirm an email change on your ${PLATFORM.name} account`,
    headline: 'Confirm an email change',
    intro: 'Enter this code from your current address:',
    cta: 'Confirm change',
    reassurance:
      "If you didn't request this change, ignore the email and your address stays as it is.",
  },
  reauthentication: {
    subject: `Re-verify your ${PLATFORM.name} session`,
    headline: 'Verify it’s you',
    intro: 'Enter this code to continue:',
    reassurance:
      "If you didn't trigger this, close the session that asked for it.",
  },
};

// ---------------------------------------------------------------------------
// Plain-text rendering
// ---------------------------------------------------------------------------

function buildText({ args, copy }: { args: RenderArgs; copy: Copy }): string {
  const lines: string[] = [];
  lines.push(PLATFORM.name);
  lines.push('');
  lines.push(copy.headline);
  lines.push('');
  lines.push(copy.intro);
  if (args.token) {
    lines.push('');
    lines.push(`    ${args.token.split('').join(' ')}`);
    lines.push('');
    lines.push(
      `This code will be active for ${args.validityMinutes} minutes.`,
    );
  }
  if (args.confirmationUrl) {
    lines.push('');
    lines.push(`Or click this link to ${copy.cta?.toLowerCase() ?? 'sign in'}:`);
    lines.push(args.confirmationUrl);
  }
  lines.push('');
  lines.push(copy.reassurance);
  lines.push('');
  lines.push('---');
  lines.push(
    `Help: ${FOOTER_LINKS.help}   About us: ${FOOTER_LINKS.about}   Legal: ${FOOTER_LINKS.legal}`,
  );
  lines.push('');
  lines.push(
    `To make sure our emails arrive, please add ${ENTITY.whitelistEmail} to your contacts.`,
  );
  lines.push(
    legalFooterLine(),
  );
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// HTML rendering
// ---------------------------------------------------------------------------

function escape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildHtml({ args, copy }: { args: RenderArgs; copy: Copy }): string {
  const codeBox = args.token
    ? `
        <div style="margin: 32px 0;">
          <div style="background: #f5f5f5; border-radius: 12px; padding: 28px 24px; text-align: center;">
            <div style="font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace; font-size: 32px; letter-spacing: 14px; color: #171717; padding-left: 14px;">
              ${escape(args.token)}
            </div>
          </div>
          <p style="margin: 16px 0 0; color: #737373; font-size: 14px; text-align: center;">
            This code will be active for ${args.validityMinutes} minutes.
          </p>
        </div>
      `
    : '';

  const cta = args.confirmationUrl
    ? `
        <p style="margin: 24px 0; text-align: center;">
          <a href="${escape(args.confirmationUrl)}"
             style="display: inline-block; background: #171717; color: #fff; text-decoration: none; font-size: 14px; font-weight: 500; padding: 12px 24px; border-radius: 8px;">
            ${escape(copy.cta ?? 'Continue')}
          </a>
        </p>
      `
    : '';

  return `<!doctype html>
<html lang="en">
<body style="margin: 0; padding: 0; background: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #171717;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #ffffff;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 560px; padding: 48px 32px;">
        <tr><td align="center">
          <!-- Platform wordmark -->
          <img src="${BRAND_ASSETS.logoUrl}" alt="${escape(BRAND_ASSETS.logoAlt)}" width="140" style="display: block; margin: 0 auto 48px; border: 0; outline: none; text-decoration: none; height: auto;" />

          <h1 style="margin: 0; font-size: 28px; font-weight: 500; letter-spacing: -0.01em; color: #171717;">
            ${escape(copy.headline)}
          </h1>

          <p style="margin: 24px 0 0; color: #525252; font-size: 15px; line-height: 1.5;">
            ${escape(copy.intro)}
          </p>

          ${codeBox}
          ${cta}

          <p style="margin: 32px 0 0; color: #737373; font-size: 13px; line-height: 1.6; max-width: 440px;">
            ${escape(copy.reassurance)}
            ${
              ENTITY.supportEmail
                ? ` Questions? Our friendly <a href="mailto:${escape(ENTITY.supportEmail)}" style="color: #525252;">support team</a> is always happy to help.`
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
          </p>

          <p style="margin: 16px 0 0; font-size: 12px; color: #a3a3a3;">
            To make sure our emails arrive, please add
            <a href="mailto:${escape(ENTITY.whitelistEmail)}" style="color: #737373;">${escape(ENTITY.whitelistEmail)}</a>
            to your contacts.
          </p>

          <p style="margin: 8px 0 0; font-size: 12px; color: #a3a3a3;">
            ${escape(legalFooterLine())}
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
