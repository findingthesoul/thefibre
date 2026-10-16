// Calendar INVITATIONS over Resend's SMTP relay, so mail clients show the
// inline Accept / Maybe / Decline bar (Sjoerd, 2026-10-16: "Yes, build it").
//
// Why not the REST API like every other mail: an inline bar appears only when
// the message itself carries the event as a BODY ALTERNATIVE —
// multipart/alternative { text/plain, text/html, text/calendar; method=X }
// (iMIP, RFC 6047). Resend's REST API takes text, html and attachments and no
// custom MIME part (checked against its docs 2026-10-16), so over REST the
// .ics can only ever arrive as a file — which is what Sjoerd's calendar check
// on 2026-10-15 found. Over SMTP we build the MIME ourselves (nodemailer's
// icalEvent) and Resend relays it from the same verified domain, with the
// same key, so From and ORGANIZER stay aligned exactly as before.
//
// ONLY invitations come here: a mail is one when an attachment is
// `text/calendar` with a METHOD (Thread session invites, Meet guest invites —
// both already build that). Everything else stays on REST, untouched.
//
// Fly staging reaches smtp.resend.com on 465/587/2465 (checked 2026-10-16).

import nodemailer, { type Transporter } from 'nodemailer';

type Attachment = { filename: string; content: string; contentType?: string };

/** The calendar attachment that makes a mail an invitation, and its method. */
export function invitationIn(
  attachments: Attachment[] | undefined,
): { calendar: Attachment; method: string; others: Attachment[] } | null {
  const calendar = (attachments ?? []).find((a) => /^text\/calendar/i.test(a.contentType ?? ''));
  const method = calendar?.contentType?.match(/method=([A-Za-z-]+)/)?.[1]?.toUpperCase();
  if (!calendar || !method) return null;
  return { calendar, method, others: (attachments ?? []).filter((a) => a !== calendar) };
}

/** The staging test mark in the event's own title too, so a test invitation
 *  is recognisable in the calendar it lands in — not only in the inbox. */
export function markIcsSummary(ics: string, prefix: string): string {
  return ics.replace(/^(SUMMARY[^:\r\n]*:)([^\r\n]*)/gm, (line, head: string, value: string) =>
    value.startsWith(prefix) ? line : `${head}${prefix}${value}`,
  );
}

let override: Transporter | null = null;
let cached: { key: string; t: Transporter } | null = null;

/** Tests only: a stream transport, so the MIME is built and read, never sent. */
export function setInviteTransportForTests(t: Transporter | null): void {
  override = t;
}

/**
 * The relay, with TIMEOUTS of our own. sendEmail is awaited inside request
 * handlers (a Meet booking, a reschedule, the organiser's SEND), and
 * nodemailer's defaults — 2 minutes to connect, 30 s greeting, 10 MINUTES of
 * socket silence — would hang a guest's booking that long before the REST
 * fallback even starts if the relay accepted TCP and then stalled
 * (coordinator review, 2026-10-16). These bound the whole SMTP attempt to
 * well under a minute.
 */
export const INVITE_SMTP_OPTIONS = {
  host: 'smtp.resend.com',
  port: 465,
  secure: true,
  connectionTimeout: 10_000,
  greetingTimeout: 10_000,
  socketTimeout: 20_000,
} as const;

function transport(key: string): Transporter {
  if (override) return override;
  if (!cached || cached.key !== key) {
    cached = { key, t: nodemailer.createTransport({ ...INVITE_SMTP_OPTIONS, auth: { user: 'resend', pass: key } }) };
  }
  return cached.t;
}

/** Send one invitation as an iMIP message. Throws on any failure — the
 *  caller falls back to REST, so the invitation still arrives as a file. */
export async function sendInvitationSmtp(
  key: string,
  m: { from: string; to: string; subject: string; text: string; html: string; replyTo?: string | undefined },
  invite: { calendar: Attachment; method: string; others: Attachment[] },
): Promise<unknown> {
  const ics = Buffer.from(invite.calendar.content, 'base64').toString('utf8');
  return transport(key).sendMail({
    from: m.from,
    to: m.to,
    subject: m.subject,
    text: m.text,
    html: m.html,
    ...(m.replyTo ? { replyTo: m.replyTo } : {}),
    // The event as a body ALTERNATIVE (the inline bar) and, by nodemailer's
    // icalEvent, as the invite.ics attachment too — clients that file from
    // the attachment keep working.
    icalEvent: { method: invite.method, filename: invite.calendar.filename || 'invite.ics', content: ics },
    attachments: invite.others.map((a) => ({
      filename: a.filename,
      content: Buffer.from(a.content, 'base64'),
      ...(a.contentType ? { contentType: a.contentType } : {}),
    })),
  });
}
