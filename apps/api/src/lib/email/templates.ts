// Booking emails — plain HTML, no MJML. Three flows:
//   bookingConfirmationInvitee — to the invitee after booking
//   bookingNotificationHost    — to the host after booking
//   bookingCancellation        — to invitee + host after cancel
//
// Times are formatted in the host's timezone (canonical) AND noted as UTC so
// the invitee sees a referenceable instant. We avoid trying to guess the
// invitee's tz from the request.

import type { Locale } from '@thefibre/shared';
import { resolveTimeZone } from '@thefibre/shared';
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
  /** The guest's own zone, as the booking recorded it. Absent for every
   *  booking made before 2026-10-07, and for any path that cannot know it —
   *  guest mail then reads in the host's zone, exactly as it did before. */
  inviteeTimezone?: string | null;
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

/**
 * A booking's When line.
 *
 * It printed the WHOLE date on both sides — "Monday, 12 October 2026 at 13:30
 * CEST → Monday, 12 October 2026 at 14:00 CEST" — which is wrong twice over.
 * It repeats a date nobody needs twice, and the second half is a
 * complete-looking date-time, so anything that truncates the line leaves the
 * END standing alone where the start should be.
 *
 * That is not theoretical: Sjoerd screenshotted the moved-booking email on
 * 2026-10-01 and its preview read "Booking moved; new date is Monday, 12
 * October 2026 at 14:00 CEST" — the end time, presented as the new date, for
 * a meeting that starts at 13:30. The body was correct; the preview was the
 * tail of this string. It was first read as a preheader reading `ends_at`,
 * which would have been a tidy explanation of a thing that does not exist:
 * these emails have no preheader, and a mail client composes the preview from
 * whatever text comes first.
 *
 * Same day — which every booking is — collapses to one date and a time span.
 * A range that genuinely crosses midnight keeps both sides, because there the
 * second date is information.
 */
function range(start: Date, end: Date, tz: string): string {
  const sameDay =
    new Intl.DateTimeFormat('en-CA', { timeZone: tz, dateStyle: 'short' }).format(start) ===
    new Intl.DateTimeFormat('en-CA', { timeZone: tz, dateStyle: 'short' }).format(end);
  if (!sameDay) return `${fmt(start, tz)} → ${fmt(end, tz)}`;
  // The end as a bare time, in the same zone, so the line reads
  // "Monday, 12 October 2026 at 13:30 – 14:00 CEST".
  const endTime = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: tz,
  }).format(end);
  const zone = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    timeZoneName: 'short',
  })
    .formatToParts(start)
    .find((p) => p.type === 'timeZoneName')?.value;
  const startFull = fmt(start, tz);
  // fmt ends with the zone; drop it so it is not printed twice.
  const startNoZone = zone && startFull.endsWith(zone)
    ? startFull.slice(0, -zone.length).trimEnd()
    : startFull;
  return `${startNoZone} – ${endTime}${zone ? ` ${zone}` : ''}`;
}

/**
 * Whose clock the line is written in, and whose is worth adding in brackets.
 *
 * A real guest in US Eastern was sent "22:00–22:30 CEST" on 2026-10-07 and
 * had to work out that it meant 16:00. The host's zone is the right one for
 * the host's own mail and the wrong one for everybody else's, so the audience
 * decides which goes first.
 *
 * The second zone is dropped when it would say the same thing — a guest in
 * Paris booking an Amsterdam host reads "16:00 CEST", not "16:00 CEST (16:00
 * CEST)". Compared on the rendered text rather than the offset, because two
 * zones can share an offset and not a name, and the name is what the reader
 * recognises.
 *
 * Both zones go through `resolveTimeZone`: a stored name that Intl rejects
 * must not throw inside an email. A typo'd zone took every signed-in page
 * down on 2026-09-28 for exactly that reason.
 */
function zonePair(
  c: Common,
  audience: 'invitee' | 'host',
): { primary: string; secondary: string | null } {
  const host = resolveTimeZone(c.hostTimezone);
  const guest = c.inviteeTimezone ? resolveTimeZone(c.inviteeTimezone) : null;
  if (audience === 'host' || !guest) return { primary: host, secondary: null };
  const reads = (tz: string) => timeWithZone(c.startsAt, tz);
  return { primary: guest, secondary: reads(guest) === reads(host) ? null : host };
}

/** "22:00 CEST" — a time and the zone it is in, no date. */
function timeWithZone(d: Date, tz: string): string {
  const time = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: tz,
  }).format(d);
  const zone = new Intl.DateTimeFormat('en-GB', { timeZone: tz, timeZoneName: 'short' })
    .formatToParts(d)
    .find((part) => part.type === 'timeZoneName')?.value;
  return zone ? `${time} ${zone}` : time;
}

/**
 * The booking's When line, for one audience.
 *
 * The bracketed half carries the DATE too when the two zones disagree about
 * which day it is — a 22:00 CEST meeting is the same evening in Amsterdam and
 * the same afternoon in New York, but an evening booking for a guest in
 * Auckland is the next morning there, and "(09:00 NZDT)" without a date is a
 * nine-hour-early meeting as far as the reader can tell.
 */
export function bookingWhen(c: Common, audience: 'invitee' | 'host'): string {
  const { primary, secondary } = zonePair(c, audience);
  const main = range(c.startsAt, c.endsAt, primary);
  if (!secondary) return main;
  const dayIn = (tz: string) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: tz, dateStyle: 'short' }).format(c.startsAt);
  const alsoReads =
    dayIn(primary) === dayIn(secondary)
      ? timeWithZone(c.startsAt, secondary)
      : fmt(c.startsAt, secondary);
  return `${main} (${alsoReads})`;
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

function detailsHtml(c: Common, audience: 'invitee' | 'host'): string {
  const rows: string[] = [];
  const L = loc(c);
  rows.push(`<tr><td style="padding:6px 0;color:#737373;width:120px;font-size:12px;">${escapeHtml(meetT(L, 'what'))}</td><td style="padding:6px 0;font-size:14px;">${escapeHtml(c.meetingName)}</td></tr>`);
  rows.push(`<tr><td style="padding:6px 0;color:#737373;font-size:12px;">${escapeHtml(meetT(L, 'when'))}</td><td style="padding:6px 0;font-size:14px;">${escapeHtml(bookingWhen(c, audience))}</td></tr>`);
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

function detailsText(c: Common, audience: 'invitee' | 'host'): string {
  const L = loc(c);
  const lines = [
    `${meetT(L, 'what')}:  ${c.meetingName}`,
    `${meetT(L, 'when')}:  ${bookingWhen(c, audience)}`,
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

${detailsText(c, 'invitee')}
${c.paymentNote ? `\n${c.paymentNote}\n` : ''}
${meetT(L, 'add_to_calendar_line', { url: icsUrl(c, 'invitee') })}
${meetT(L, 'different_time_line', { url: rescheduleUrl(c) })}
${meetT(L, 'need_cancel_line', { url: cancel })}

${emailSignoff()}`;
  const html = shell(
    meetT(L, 'confirmed_title'),
    `<h1 style="margin:8px 0 0 0;font-size:24px;font-weight:500;letter-spacing:-0.01em;">${escapeHtml(meetT(L, 'confirmed_headline', { first }))}</h1>
${detailsHtml(c, 'invitee')}
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

${detailsText(c, 'invitee')}

${meetT(L, 'different_time_line', { url: rescheduleUrl(c) })}
${meetT(L, 'requested_changed_mind', { url: cancelUrl(c) })}

${emailSignoff()}`;
  const html = shell(
    meetT(L, 'requested_title'),
    `<h1 style="margin:8px 0 0 0;font-size:24px;font-weight:500;letter-spacing:-0.01em;">${escapeHtml(meetT(L, 'requested_headline', { host: c.hostName }))}</h1>
<div style="margin-top:6px;font-size:14px;color:#525252;">${escapeHtml(meetT(L, 'requested_sub'))}</div>
${detailsHtml(c, 'invitee')}
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

${detailsText(c, 'host')}

Add to your calendar: ${icsUrl(c, 'host')}
Need a different time? ${rescheduleUrl(c)}
Need to cancel? ${cancelUrl(c)}

${emailSignoff()}`;
  const html = shell(
    'New booking',
    `<h1 style="margin:8px 0 0 0;font-size:24px;font-weight:500;letter-spacing:-0.01em;">${escapeHtml(c.inviteeName)} booked ${escapeHtml(c.meetingName)}.</h1>
<div style="margin-top:6px;font-size:14px;color:#525252;">${escapeHtml(c.inviteeEmail)}</div>
${detailsHtml(c, 'host')}
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
      ? `${meetT(L, 'cancelled_text_invitee')}\n\n${detailsText(c, audience)}\n\n${emailSignoff()}`
      : `${c.inviteeName} cancelled their booking.\n\n${detailsText(c, audience)}\n\n${emailSignoff()}`;
  const html = shell(
    meetT(L, 'cancelled_title'),
    `<h1 style="margin:8px 0 0 0;font-size:24px;font-weight:500;letter-spacing:-0.01em;">${headline}</h1>
${detailsHtml(c, audience)}`,
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
  // The old time in the zone the reader is being written to, not the
  // host's: an invitee told "was 22:00 CEST, is now 23:00 CEST" has to do
  // the conversion twice.
  const was = fmt(previousStartsAt, zonePair(c, audience).primary);
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

${detailsText(c, audience)}

${meetT(L, 'add_to_calendar_line', { url: icsUrl(c, audience) })}
${meetT(L, 'need_cancel_line', { url: cancelUrl(c) })}

${emailSignoff()}`;
  const html = shell(
    meetT(L, 'moved_title'),
    `<h1 style="margin:8px 0 0 0;font-size:24px;font-weight:500;letter-spacing:-0.01em;">${headline}</h1>
<div style="margin-top:6px;font-size:14px;color:#525252;">${escapeHtml(meetT(L, 'was_label'))}: <s>${escapeHtml(was)}</s></div>
${detailsHtml(c, audience)}
<div style="margin-top:28px;font-size:13px;color:#525252;"><a href="${icsUrl(c, audience)}" style="color:#171717;">${escapeHtml(meetT(L, 'add_to_calendar'))}</a> &nbsp;·&nbsp; <a href="${cancelUrl(c)}" style="color:#171717;">${escapeHtml(meetT(L, 'cancel'))}</a></div>`,
    c.brand,
  );
  return { subject, text, html };
}

export type { Common as EmailCommon };
