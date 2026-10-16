// Invitations go over SMTP as an iMIP message, so mail clients show the inline
// Accept bar; everything else stays on REST (lib/email/invite-smtp.ts).
//
// The transport here is nodemailer's STREAM transport: the real MIME is built
// and read back, nothing is sent. Resend's REST endpoint is a fake at fetch.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import nodemailer from 'nodemailer';
import { INVITE_SMTP_OPTIONS, invitationIn, markIcsSummary, setInviteTransportForTests } from './invite-smtp.js';

const ICS = (method: string) =>
  [
    'BEGIN:VCALENDAR',
    `METHOD:${method}`,
    'BEGIN:VEVENT',
    'UID:meet-1@thefibre.app',
    'SEQUENCE:2',
    'SUMMARY:Short call with Sjoerd',
    'ORGANIZER;CN=Sjoerd Luteijn:mailto:noreply@thethread.app',
    'ATTENDEE;CN=Guest;RSVP=TRUE:mailto:guest@example.com',
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n');
const b64 = (s: string) => Buffer.from(s, 'utf8').toString('base64');
const invite = (method: string) => ({ filename: 'invite.ics', content: b64(ICS(method)), contentType: `text/calendar; charset=utf-8; method=${method}` });
const pdf = { filename: 'invoice.pdf', content: b64('%PDF-1.4 fake') };

/** The raw MIME of every message the stream transport built. */
const built: string[] = [];
const stream = nodemailer.createTransport({ streamTransport: true, buffer: true, newline: 'unix' });
const recording = {
  sendMail: async (m: Parameters<typeof stream.sendMail>[0]) => {
    const info = await stream.sendMail(m);
    built.push((info.message as Buffer).toString());
    return info;
  },
} as unknown as typeof stream;

const restCalls: { url: string; body: Record<string, unknown> }[] = [];
const realFetch = globalThis.fetch;

beforeEach(() => {
  built.length = 0;
  restCalls.length = 0;
  vi.stubEnv('RESEND_API_KEY', 're_test_fake');
  vi.stubEnv('FLY_APP_NAME', '');
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    restCalls.push({ url: String(url), body: JSON.parse(String(init?.body ?? '{}')) });
    return new Response('{"id":"x"}', { status: 200 });
  });
  setInviteTransportForTests(recording);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.stubGlobal('fetch', realFetch);
  setInviteTransportForTests(null);
});

const { sendEmail } = await import('./client.js');
const base = { to: 'guest@example.com', subject: 'Your booking', text: 'See you', html: '<p>See you</p>' };

/** The part headers of one message, in order. */
const parts = (raw: string) => raw.split('\n').filter((l) => /^Content-(Type|Disposition):/i.test(l));
/** The text/calendar ALTERNATIVE body (nodemailer writes it quoted-printable or base64). */
function calendarBody(raw: string): string {
  const i = raw.search(/^Content-Type: text\/calendar/m);
  const tail = raw.slice(i);
  const enc = tail.match(/^Content-Transfer-Encoding: (\S+)/m)?.[1]?.toLowerCase();
  const body = tail.split(/\n\n/)[1]!.split(/\n----/)[0]!;
  if (enc === 'base64') return Buffer.from(body.replace(/\s+/g, ''), 'base64').toString('utf8');
  return body.replace(/=\n/g, '').replace(/=([0-9A-F]{2})/g, (_, h: string) => String.fromCharCode(parseInt(h, 16)));
}

describe('the relay cannot hang a request', () => {
  it('connect, greeting and socket timeouts are set and short (nodemailer defaults are 2 min / 30 s / 10 min)', () => {
    expect(INVITE_SMTP_OPTIONS).toMatchObject({ host: 'smtp.resend.com', port: 465, secure: true });
    expect(INVITE_SMTP_OPTIONS.connectionTimeout).toBeLessThanOrEqual(10_000);
    expect(INVITE_SMTP_OPTIONS.greetingTimeout).toBeLessThanOrEqual(10_000);
    expect(INVITE_SMTP_OPTIONS.socketTimeout).toBeLessThanOrEqual(20_000);
  });
});

describe('which mails are invitations', () => {
  it('a text/calendar attachment with a method; a PDF or a method-less calendar is not', () => {
    expect(invitationIn([invite('REQUEST'), pdf])).toMatchObject({ method: 'REQUEST', others: [pdf] });
    expect(invitationIn([invite('CANCEL')])?.method).toBe('CANCEL');
    expect(invitationIn([pdf])).toBeNull();
    expect(invitationIn([{ filename: 'x.ics', content: '', contentType: 'text/calendar; charset=utf-8' }])).toBeNull();
    expect(invitationIn(undefined)).toBeNull();
  });
});

describe('an invitation is an iMIP message', () => {
  it('REQUEST: mixed { alternative { text, html, text/calendar method=REQUEST }, invite.ics } — over SMTP, not REST', async () => {
    await sendEmail({ ...base, attachments: [invite('REQUEST')], fromName: 'Sjoerd' });
    expect(restCalls).toEqual([]);
    expect(built).toHaveLength(1);
    expect(parts(built[0]!)).toEqual([
      expect.stringMatching(/^Content-Type: multipart\/mixed/),
      expect.stringMatching(/^Content-Type: multipart\/alternative/),
      'Content-Type: text/plain; charset=utf-8',
      'Content-Type: text/html; charset=utf-8',
      'Content-Type: text/calendar; charset=utf-8; method=REQUEST',
      'Content-Type: application/ics; name=invite.ics',
      'Content-Disposition: attachment; filename=invite.ics',
    ]);
    // The event itself unchanged: same uid, sequence, organiser, attendee.
    const cal = calendarBody(built[0]!);
    for (const line of ['UID:meet-1@thefibre.app', 'SEQUENCE:2', 'ORGANIZER;CN=Sjoerd Luteijn:mailto:noreply@thethread.app', 'ATTENDEE;CN=Guest;RSVP=TRUE:mailto:guest@example.com']) {
      expect(cal).toContain(line);
    }
    // From is the same composed sender as the REST path.
    expect(built[0]).toMatch(/^From: Sjoerd <[^>]+>$/m);
  });

  it('CANCEL keeps its method in the alternative', async () => {
    await sendEmail({ ...base, attachments: [invite('CANCEL')] });
    expect(parts(built[0]!)).toContain('Content-Type: text/calendar; charset=utf-8; method=CANCEL');
  });

  it('other attachments ride along', async () => {
    await sendEmail({ ...base, attachments: [invite('REQUEST'), pdf] });
    expect(parts(built[0]!).some((l) => l.includes('invoice.pdf'))).toBe(true);
  });
});

describe('everything else stays on REST', () => {
  it('a mail with no invitation never touches SMTP', async () => {
    await sendEmail({ ...base, attachments: [pdf] });
    expect(built).toEqual([]);
    expect(restCalls).toHaveLength(1);
    expect(restCalls[0]!.url).toBe('https://api.resend.com/emails');
  });

  it('when SMTP fails, the invitation still goes — as a file, over REST', async () => {
    setInviteTransportForTests({ sendMail: async () => { throw new Error('smtp down'); } } as unknown as typeof stream);
    await sendEmail({ ...base, attachments: [invite('REQUEST')] });
    expect(restCalls).toHaveLength(1);
    const att = (restCalls[0]!.body.attachments as { content_type?: string }[])[0]!;
    expect(att.content_type).toBe('text/calendar; charset=utf-8; method=REQUEST');
  });
});

describe('staging marks the event title too', () => {
  it('markIcsSummary prefixes once, params kept', () => {
    expect(markIcsSummary('SUMMARY:Call\r\n', '[STAGING] ')).toBe('SUMMARY:[STAGING] Call\r\n');
    expect(markIcsSummary('SUMMARY;LANGUAGE=en:Call\r\n', '[STAGING] ')).toBe('SUMMARY;LANGUAGE=en:[STAGING] Call\r\n');
    expect(markIcsSummary('SUMMARY:[STAGING] Call\r\n', '[STAGING] ')).toBe('SUMMARY:[STAGING] Call\r\n');
  });

  it('on the staging app the calendar SUMMARY carries the mark; elsewhere it does not', async () => {
    vi.stubEnv('FLY_APP_NAME', 'thefibre-api-staging');
    await sendEmail({ ...base, attachments: [invite('REQUEST')] });
    expect(calendarBody(built[0]!)).toContain('SUMMARY:[STAGING] Short call with Sjoerd');
    built.length = 0;
    vi.stubEnv('FLY_APP_NAME', 'thefibre-api');
    await sendEmail({ ...base, attachments: [invite('REQUEST')] });
    expect(calendarBody(built[0]!)).toContain('SUMMARY:Short call with Sjoerd');
    expect(calendarBody(built[0]!)).not.toContain('[STAGING]');
  });
});
