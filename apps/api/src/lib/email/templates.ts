// Booking emails — plain HTML, no MJML. Three flows:
//   bookingConfirmationInvitee — to the invitee after booking
//   bookingNotificationHost    — to the host after booking
//   bookingCancellation        — to invitee + host after cancel
//
// Times are formatted in the host's timezone (canonical) AND noted as UTC so
// the invitee sees a referenceable instant. We avoid trying to guess the
// invitee's tz from the request.

import {
  emailSignoff,
  legalFooterLine,
  BRAND_ASSETS,
  ENTITY,
  FOOTER_LINKS,
} from '@thefibre/shared';

type Common = {
  inviteeName: string;
  inviteeEmail: string;
  hostName: string;
  hostEmail: string | null;
  meetingName: string;
  startsAt: Date;
  endsAt: Date;
  hostTimezone: string;
  meetUrl?: string | null;
  location?: string | null;
  bookingId: string;
  // Public URL of the Meet app (used to build cancel link).
  meetAppUrl: string;
  hostSlug: string;
  meetingTypeSlug: string;
};

function fmt(d: Date, tz: string): string {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: tz,
      timeZoneName: 'short',
    }).format(d);
  } catch {
    return d.toUTCString();
  }
}

function range(start: Date, end: Date, tz: string): string {
  return `${fmt(start, tz)} → ${fmt(end, tz)}`;
}

function cancelUrl(c: Common): string {
  return `${c.meetAppUrl}/${encodeURIComponent(c.hostSlug)}/${encodeURIComponent(
    c.meetingTypeSlug,
  )}/cancel/${encodeURIComponent(c.bookingId)}`;
}

// Booking emails reuse the same visual shell as auth emails (v0.10.0):
// centred wordmark, white canvas, Help / About / Legal footer, whitelist
// hint, legal address line. Single source of truth so they look like one
// product family.
function shell(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html lang="en">
<body style="margin: 0; padding: 0; background: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #171717;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #ffffff;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 560px; padding: 48px 32px;">
        <tr><td align="center">
          <img src="${BRAND_ASSETS.logoUrl}" alt="${escapeHtml(BRAND_ASSETS.logoAlt)}" width="140" style="display: block; margin: 0 auto 32px; border: 0; outline: none; text-decoration: none; height: auto;" />
          <div style="font-size: 12px; letter-spacing: 0.18em; text-transform: uppercase; color: #737373; margin-bottom: 8px;">${escapeHtml(title)}</div>
          <div style="text-align: left;">
            ${bodyHtml}
          </div>
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
            <a href="mailto:${escapeHtml(ENTITY.whitelistEmail)}" style="color: #737373;">${escapeHtml(ENTITY.whitelistEmail)}</a>
            to your contacts.
          </p>
          <p style="margin: 12px 0 0; font-size: 11px; color: #a3a3a3;">${escapeHtml(legalFooterLine())}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function detailsHtml(c: Common): string {
  const rows: string[] = [];
  rows.push(`<tr><td style="padding:6px 0;color:#737373;width:120px;font-size:12px;">What</td><td style="padding:6px 0;font-size:14px;">${escapeHtml(c.meetingName)}</td></tr>`);
  rows.push(`<tr><td style="padding:6px 0;color:#737373;font-size:12px;">When</td><td style="padding:6px 0;font-size:14px;">${escapeHtml(range(c.startsAt, c.endsAt, c.hostTimezone))}</td></tr>`);
  rows.push(`<tr><td style="padding:6px 0;color:#737373;font-size:12px;">With</td><td style="padding:6px 0;font-size:14px;">${escapeHtml(c.hostName)}</td></tr>`);
  if (c.meetUrl) {
    rows.push(`<tr><td style="padding:6px 0;color:#737373;font-size:12px;">Join</td><td style="padding:6px 0;font-size:14px;"><a href="${c.meetUrl}" style="color:#171717;">${escapeHtml(c.meetUrl)}</a></td></tr>`);
  }
  if (c.location) {
    rows.push(`<tr><td style="padding:6px 0;color:#737373;font-size:12px;">Where</td><td style="padding:6px 0;font-size:14px;">${escapeHtml(c.location)}</td></tr>`);
  }
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:20px;">${rows.join('')}</table>`;
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function detailsText(c: Common): string {
  const lines = [
    `What:  ${c.meetingName}`,
    `When:  ${range(c.startsAt, c.endsAt, c.hostTimezone)}`,
    `With:  ${c.hostName}`,
  ];
  if (c.meetUrl) lines.push(`Join:  ${c.meetUrl}`);
  if (c.location) lines.push(`Where: ${c.location}`);
  return lines.join('\n');
}

export function bookingConfirmationInvitee(c: Common): {
  subject: string;
  text: string;
  html: string;
} {
  const subject = `Confirmed: ${c.meetingName} with ${c.hostName}`;
  const cancel = cancelUrl(c);
  const text = `Hi ${c.inviteeName.split(' ')[0] ?? ''},

You're booked.

${detailsText(c)}

Need to cancel? ${cancel}

${emailSignoff()}`;
  const html = shell(
    'Booking confirmed',
    `<h1 style="margin:8px 0 0 0;font-size:24px;font-weight:500;letter-spacing:-0.01em;">You're booked, ${escapeHtml(c.inviteeName.split(' ')[0] ?? '')}.</h1>
${detailsHtml(c)}
<div style="margin-top:28px;font-size:13px;color:#525252;">Need to cancel or reschedule? <a href="${cancel}" style="color:#171717;">Cancel this booking</a>.</div>`,
  );
  return { subject, text, html };
}

export function bookingNotificationHost(c: Common): {
  subject: string;
  text: string;
  html: string;
} {
  const subject = `New booking: ${c.meetingName} — ${c.inviteeName}`;
  const text = `${c.inviteeName} (${c.inviteeEmail}) booked ${c.meetingName}.

${detailsText(c)}

${emailSignoff()}`;
  const html = shell(
    'New booking',
    `<h1 style="margin:8px 0 0 0;font-size:24px;font-weight:500;letter-spacing:-0.01em;">${escapeHtml(c.inviteeName)} booked ${escapeHtml(c.meetingName)}.</h1>
<div style="margin-top:6px;font-size:14px;color:#525252;">${escapeHtml(c.inviteeEmail)}</div>
${detailsHtml(c)}`,
  );
  return { subject, text, html };
}

export function bookingCancellation(
  c: Common,
  audience: 'invitee' | 'host',
): { subject: string; text: string; html: string } {
  const subject =
    audience === 'invitee'
      ? `Cancelled: ${c.meetingName} with ${c.hostName}`
      : `Cancelled: ${c.meetingName} — ${c.inviteeName}`;
  const headline =
    audience === 'invitee'
      ? `Your booking with ${escapeHtml(c.hostName)} was cancelled.`
      : `${escapeHtml(c.inviteeName)} cancelled ${escapeHtml(c.meetingName)}.`;
  const text =
    audience === 'invitee'
      ? `Your booking has been cancelled.\n\n${detailsText(c)}\n\n${emailSignoff()}`
      : `${c.inviteeName} cancelled their booking.\n\n${detailsText(c)}\n\n${emailSignoff()}`;
  const html = shell(
    'Booking cancelled',
    `<h1 style="margin:8px 0 0 0;font-size:24px;font-weight:500;letter-spacing:-0.01em;">${headline}</h1>
${detailsHtml(c)}`,
  );
  return { subject, text, html };
}

export type { Common as EmailCommon };
