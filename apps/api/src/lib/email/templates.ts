// Booking emails — plain HTML, no MJML. Three flows:
//   bookingConfirmationInvitee — to the invitee after booking
//   bookingNotificationHost    — to the host after booking
//   bookingCancellation        — to invitee + host after cancel
//
// Times are formatted in the host's timezone (canonical) AND noted as UTC so
// the invitee sees a referenceable instant. We avoid trying to guess the
// invitee's tz from the request.

import type { Locale } from '@thefibre/shared';
import { meetT } from './meet-booking-i18n.js';
import {
  emailSignoff,
  legalFooterLine,
  EMAIL_BRAND,
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
  /** Which language this mail is written in. Resolved by the CALLER through
   *  resolveEmailLocale in @thefibre/shared — the templates render whatever
   *  they are handed, which is why the same function serves an invitee in
   *  Dutch and a host in German. Omitted → English. */
  locale?: Locale;
  hostSlug: string;
  meetingTypeSlug: string;
  /** Pay-by-invoice bookings: e.g. "€60.00 — the host will send you an
   *  invoice." Shown on the invitee's confirmation only. */
  paymentNote?: string | null;
  /** The workspace's mark, when it has one. Absent = The Thread's. */
  brand?: EmailBrand | undefined;
};

/** A time a person can read, in a given zone — "Monday, 28 September 2026 at
 *  15:00 CEST". Exported because Meet's hand-written approval mail printed a
 *  raw ISO stamp beside a sibling email that formatted the same moment
 *  (reported from a real booking, 2026-09-23). */
export function formatWhen(d: Date, tz: string): string {
  return fmt(d, tz);
}

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

function bookingBaseUrl(c: Common): string {
  return `${c.meetAppUrl}/${encodeURIComponent(c.hostSlug)}/${encodeURIComponent(
    c.meetingTypeSlug,
  )}/confirmed/${encodeURIComponent(c.bookingId)}`;
}

/** "Add to calendar" — the .ics the API renders for this booking, proxied by
 *  the Meet app so the link stays on the app's own domain.
 *
 *  The audience is in the link because the file differs by it: a calendar
 *  entry names the person on the OTHER side, so the host's copy says the
 *  invitee and the invitee's says the host. Get this wrong and someone books
 *  an hour with themselves. */
function icsUrl(c: Common, audience: 'invitee' | 'host'): string {
  return `${bookingBaseUrl(c)}/calendar.ics${audience === 'host' ? '?for=host' : ''}`;
}

function rescheduleUrl(c: Common): string {
  return `${c.meetAppUrl}/${encodeURIComponent(c.hostSlug)}/${encodeURIComponent(
    c.meetingTypeSlug,
  )}?reschedule=${encodeURIComponent(c.bookingId)}`;
}

// Booking emails reuse the same visual shell as auth emails (v0.10.0):
// centred wordmark, white canvas, Help / About / Legal footer, whitelist
// hint, legal address line. Single source of truth so they look like one
// product family. Exported so other apps' templates (Thread) share it.
/**
 * `brand` lets a workspace put its own logo at the top. Everything else stays:
 * the footer links, the whitelist hint and the legal line are the platform's
 * obligations, not decoration, and they are true of the mail whoever it looks
 * like it came from.
 */
export type EmailBrand = { logoUrl?: string | null; name?: string | null };

export function shell(title: string, bodyHtml: string, brand?: EmailBrand): string {
  // The workspace's own mark when it has one; otherwise THE THREAD, not The
  // Fibre (Sjoerd, 2026-09-23, on a booking email wearing the fibre wordmark:
  // "Should this not be THE THREAD? and WORKSPACE in this specific case?").
  // The branding pivot of 2026-09-08 made The Thread the public face and The
  // Fibre backstage; the auth and platform emails moved then, and these did
  // not. BRAND_ASSETS stays what it is — the Fibre wordmark, for Fibre's own
  // surfaces — rather than being redefined underneath its other readers.
  const logoUrl = brand?.logoUrl || EMAIL_BRAND.logoUrl;
  const logoAlt = brand?.logoUrl ? brand.name || '' : EMAIL_BRAND.logoAlt;
  return `<!doctype html>
<html lang="en">
<body style="margin: 0; padding: 0; background: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #171717;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #ffffff;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 560px; padding: 48px 32px;">
        <tr><td align="center">
          <img src="${logoUrl}" alt="${escapeHtml(logoAlt)}" width="140" style="display: block; margin: 0 auto 32px; border: 0; outline: none; text-decoration: none; height: auto; max-width: 140px;" />
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
            &nbsp;·&nbsp;
            <a href="${FOOTER_LINKS.privacy}" style="color: #525252; text-decoration: none;">Privacy</a>
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

/** The mail's language, defaulting to English for a caller that has not
 *  resolved one yet. */
function loc(c: Common): Locale {
  return c.locale ?? 'en';
}

/** The first name we greet somebody by — "" when we only have one word. */
function firstName(full: string): string {
  return full.split(' ')[0] ?? '';
}

function detailsHtml(c: Common): string {
  const rows: string[] = [];
  const L = loc(c);
  rows.push(`<tr><td style="padding:6px 0;color:#737373;width:120px;font-size:12px;">${escapeHtml(meetT(L, 'what'))}</td><td style="padding:6px 0;font-size:14px;">${escapeHtml(c.meetingName)}</td></tr>`);
  rows.push(`<tr><td style="padding:6px 0;color:#737373;font-size:12px;">${escapeHtml(meetT(L, 'when'))}</td><td style="padding:6px 0;font-size:14px;">${escapeHtml(range(c.startsAt, c.endsAt, c.hostTimezone))}</td></tr>`);
  rows.push(`<tr><td style="padding:6px 0;color:#737373;font-size:12px;">${escapeHtml(meetT(L, 'with_whom'))}</td><td style="padding:6px 0;font-size:14px;">${escapeHtml(c.hostName)}</td></tr>`);
  if (c.meetUrl) {
    rows.push(`<tr><td style="padding:6px 0;color:#737373;font-size:12px;">${escapeHtml(meetT(L, 'join'))}</td><td style="padding:6px 0;font-size:14px;"><a href="${c.meetUrl}" style="color:#171717;">${escapeHtml(c.meetUrl)}</a></td></tr>`);
  }
  if (c.location) {
    rows.push(`<tr><td style="padding:6px 0;color:#737373;font-size:12px;">${escapeHtml(meetT(L, 'where'))}</td><td style="padding:6px 0;font-size:14px;">${escapeHtml(c.location)}</td></tr>`);
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
  const L = loc(c);
  const lines = [
    `${meetT(L, 'what')}:  ${c.meetingName}`,
    `${meetT(L, 'when')}:  ${range(c.startsAt, c.endsAt, c.hostTimezone)}`,
    `${meetT(L, 'with_whom')}:  ${c.hostName}`,
  ];
  if (c.meetUrl) lines.push(`${meetT(L, 'join')}:  ${c.meetUrl}`);
  if (c.location) lines.push(`${meetT(L, 'where')}: ${c.location}`);
  return lines.join('\n');
}

export function bookingConfirmationInvitee(c: Common): {
  subject: string;
  text: string;
  html: string;
} {
  const L = loc(c);
  const first = firstName(c.inviteeName);
  const subject = meetT(L, 'confirmed_subject', { meeting: c.meetingName, host: c.hostName });
  const cancel = cancelUrl(c);
  const text = `${meetT(L, 'greeting', { first })}

${meetT(L, 'confirmed_text_lead')}

${detailsText(c)}
${c.paymentNote ? `\n${c.paymentNote}\n` : ''}
${meetT(L, 'add_to_calendar_line', { url: icsUrl(c, 'invitee') })}
${meetT(L, 'different_time_line', { url: rescheduleUrl(c) })}
${meetT(L, 'need_cancel_line', { url: cancel })}

${emailSignoff()}`;
  const html = shell(
    meetT(L, 'confirmed_title'),
    `<h1 style="margin:8px 0 0 0;font-size:24px;font-weight:500;letter-spacing:-0.01em;">${escapeHtml(meetT(L, 'confirmed_headline', { first }))}</h1>
${detailsHtml(c)}
${c.paymentNote ? `<p style="margin-top:20px;font-size:14px;color:#171717;">${escapeHtml(c.paymentNote)}</p>` : ''}
<div style="margin-top:28px;font-size:13px;color:#525252;"><a href="${icsUrl(c, 'invitee')}" style="color:#171717;">${escapeHtml(meetT(L, 'add_to_calendar'))}</a> &nbsp;·&nbsp; <a href="${rescheduleUrl(c)}" style="color:#171717;">${escapeHtml(meetT(L, 'reschedule'))}</a> &nbsp;·&nbsp; <a href="${cancel}" style="color:#171717;">${escapeHtml(meetT(L, 'cancel'))}</a></div>`,
    c.brand,
  );
  return { subject, text, html };
}

/**
 * Sent to the invitee when the meeting type needs the host's approval — the
 * only booking mail in this file that confirms nothing.
 *
 * It used to be written inline at the call site with no links at all, so a
 * person whose request was waiting had no way back to it: no page, no
 * reschedule, no way to withdraw (Sjoerd, 2026-09-24, relaying "the
 * reschedule option is not there"). It lives here now for the same reason the
 * others do — the links are built once, by the same helpers, so this mail
 * cannot drift away from them again.
 *
 * No "Add to calendar": nothing is in anyone's calendar yet, and offering a
 * file for a time that may not happen is worse than offering nothing.
 */
export function bookingRequestReceived(c: Common): {
  subject: string;
  text: string;
  html: string;
} {
  const L = loc(c);
  const first = firstName(c.inviteeName);
  const subject = meetT(L, 'requested_subject', { meeting: c.meetingName });
  const text = `${meetT(L, 'greeting', { first })}

${meetT(L, 'requested_headline', { host: c.hostName })} ${meetT(L, 'requested_sub')}

${detailsText(c)}

${meetT(L, 'different_time_line', { url: rescheduleUrl(c) })}
${meetT(L, 'requested_changed_mind', { url: cancelUrl(c) })}

${emailSignoff()}`;
  const html = shell(
    meetT(L, 'requested_title'),
    `<h1 style="margin:8px 0 0 0;font-size:24px;font-weight:500;letter-spacing:-0.01em;">${escapeHtml(meetT(L, 'requested_headline', { host: c.hostName }))}</h1>
<div style="margin-top:6px;font-size:14px;color:#525252;">${escapeHtml(meetT(L, 'requested_sub'))}</div>
${detailsHtml(c)}
<div style="margin-top:28px;font-size:13px;color:#525252;"><a href="${rescheduleUrl(c)}" style="color:#171717;">${escapeHtml(meetT(L, 'requested_ask_other_time'))}</a> &nbsp;·&nbsp; <a href="${cancelUrl(c)}" style="color:#171717;">${escapeHtml(meetT(L, 'requested_withdraw'))}</a></div>`,
    c.brand,
  );
  return { subject, text, html };
}

export function bookingNotificationHost(c: Common): {
  subject: string;
  text: string;
  html: string;
} {
  const subject = `New booking: ${c.meetingName} — ${c.inviteeName}`;
  // The host gets the same three actions as the invitee (Sjoerd, 2026-09-23:
  // "I dont see a reschedule button in the confirmation email" / "Also not:
  // add to calendar... file"). The host's copy had the details and no way to
  // act on them — and it is the host, more often than the invitee, who needs
  // to move a meeting. The links are the same public ones; they identify the
  // booking, not the person clicking.
  const text = `${c.inviteeName} (${c.inviteeEmail}) booked ${c.meetingName}.

${detailsText(c)}

Add to your calendar: ${icsUrl(c, 'host')}
Need a different time? ${rescheduleUrl(c)}
Need to cancel? ${cancelUrl(c)}

${emailSignoff()}`;
  const html = shell(
    'New booking',
    `<h1 style="margin:8px 0 0 0;font-size:24px;font-weight:500;letter-spacing:-0.01em;">${escapeHtml(c.inviteeName)} booked ${escapeHtml(c.meetingName)}.</h1>
<div style="margin-top:6px;font-size:14px;color:#525252;">${escapeHtml(c.inviteeEmail)}</div>
${detailsHtml(c)}
<div style="margin-top:28px;font-size:13px;color:#525252;"><a href="${icsUrl(c, 'host')}" style="color:#171717;">Add to calendar</a> &nbsp;·&nbsp; <a href="${rescheduleUrl(c)}" style="color:#171717;">Reschedule</a> &nbsp;·&nbsp; <a href="${cancelUrl(c)}" style="color:#171717;">Cancel</a></div>`,
    c.brand,
  );
  return { subject, text, html };
}

export function bookingCancellation(
  c: Common,
  audience: 'invitee' | 'host',
): { subject: string; text: string; html: string } {
  const L = loc(c);
  const subject =
    audience === 'invitee'
      ? meetT(L, 'cancelled_subject_invitee', { meeting: c.meetingName, host: c.hostName })
      : `Cancelled: ${c.meetingName} — ${c.inviteeName}`;
  const headline =
    audience === 'invitee'
      ? escapeHtml(meetT(L, 'cancelled_headline_invitee', { host: c.hostName }))
      : `${escapeHtml(c.inviteeName)} cancelled ${escapeHtml(c.meetingName)}.`;
  const text =
    audience === 'invitee'
      ? `${meetT(L, 'cancelled_text_invitee')}\n\n${detailsText(c)}\n\n${emailSignoff()}`
      : `${c.inviteeName} cancelled their booking.\n\n${detailsText(c)}\n\n${emailSignoff()}`;
  const html = shell(
    meetT(L, 'cancelled_title'),
    `<h1 style="margin:8px 0 0 0;font-size:24px;font-weight:500;letter-spacing:-0.01em;">${headline}</h1>
${detailsHtml(c)}`,
    c.brand,
  );
  return { subject, text, html };
}

/** Sent to both sides when a booking moves. The invitee's own reschedule and
 *  the host's both land here — the copy only differs in who is told. */
export function bookingRescheduled(
  c: Common,
  audience: 'invitee' | 'host',
  previousStartsAt: Date,
): { subject: string; text: string; html: string } {
  const was = fmt(previousStartsAt, c.hostTimezone);
  const L = loc(c);
  const subject =
    audience === 'invitee'
      ? meetT(L, 'moved_subject_invitee', { meeting: c.meetingName, host: c.hostName })
      : `Moved: ${c.meetingName} — ${c.inviteeName}`;
  const headline =
    audience === 'invitee'
      ? escapeHtml(meetT(L, 'moved_headline_invitee', { host: c.hostName }))
      : `${escapeHtml(c.inviteeName)} moved ${escapeHtml(c.meetingName)}.`;
  const text = `${
    audience === 'invitee'
      ? meetT(L, 'moved_text_invitee')
      : `${c.inviteeName} moved their booking.`
  }

${meetT(L, 'was_label')}:   ${was}

${detailsText(c)}

${meetT(L, 'add_to_calendar_line', { url: icsUrl(c, audience) })}
${meetT(L, 'need_cancel_line', { url: cancelUrl(c) })}

${emailSignoff()}`;
  const html = shell(
    meetT(L, 'moved_title'),
    `<h1 style="margin:8px 0 0 0;font-size:24px;font-weight:500;letter-spacing:-0.01em;">${headline}</h1>
<div style="margin-top:6px;font-size:14px;color:#525252;">${escapeHtml(meetT(L, 'was_label'))}: <s>${escapeHtml(was)}</s></div>
${detailsHtml(c)}
<div style="margin-top:28px;font-size:13px;color:#525252;"><a href="${icsUrl(c, audience)}" style="color:#171717;">${escapeHtml(meetT(L, 'add_to_calendar'))}</a> &nbsp;·&nbsp; <a href="${cancelUrl(c)}" style="color:#171717;">${escapeHtml(meetT(L, 'cancel'))}</a></div>`,
    c.brand,
  );
  return { subject, text, html };
}

export type { Common as EmailCommon };
