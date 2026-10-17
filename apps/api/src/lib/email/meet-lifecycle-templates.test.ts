import { describe, expect, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import type { Locale } from '@thefibre/shared';
import {
  approvalNeededHost,
  bookingDeclinedInvitee,
  meetAccessInvite,
  meetMoney,
  paymentDueInvitee,
  requestExpiredHost,
  requestExpiredInvitee,
  teamInvite,
  teamInviteReminder,
  type LifecycleMail,
} from './meet-lifecycle-templates.js';

const WHEN = 'Monday, 2 November 2026 at 10:00 CET';
const all = (L: Locale): Record<string, LifecycleMail> => ({
  requestExpiredInvitee: requestExpiredInvitee(L, { inviteeName: 'Anna de Vries', hostName: 'Sjoerd', meeting: 'Intake', when: WHEN, askAgainUrl: 'https://meet.example/s/intake?reschedule=1' }),
  requestExpiredHost: requestExpiredHost(L, { inviteeName: 'Anna de Vries', inviteeEmail: 'anna@example.com', meeting: 'Intake', when: WHEN, askAgainUrl: 'https://meet.example/s/intake?reschedule=1' }),
  approvalNeededHost: approvalNeededHost(L, { inviteeName: 'Anna de Vries', inviteeEmail: 'anna@example.com', meeting: 'Intake', when: WHEN, movedFromWhen: null, reviewUrl: 'https://meet.example/bookings' }),
  approvalNeededHostMoved: approvalNeededHost(L, { inviteeName: 'Anna de Vries', inviteeEmail: 'anna@example.com', meeting: 'Intake', when: WHEN, movedFromWhen: 'Friday, 30 October 2026 at 09:00 CET', reviewUrl: 'https://meet.example/bookings' }),
  bookingDeclinedInvitee: bookingDeclinedInvitee(L, { inviteeName: 'Anna de Vries', hostName: 'Sjoerd', meeting: 'Intake', note: 'Full this week.' }),
  paymentDueInvitee: paymentDueInvitee(L, { inviteeName: 'Anna de Vries', meeting: 'Intake', amount: meetMoney(L, 6000, 'eur'), payUrl: 'https://pay.example/x' }),
  meetAccessInvite: meetAccessInvite(L, { inviterName: 'Sjoerd', email: 'anna@example.com', signInUrl: 'https://thefibre.app' }),
  teamInvite: teamInvite(L, { inviterName: 'Sjoerd', teamName: 'Coaches', email: 'anna@example.com', acceptUrl: 'https://meet.example/invite/inv_1' }),
  teamInviteReminder: teamInviteReminder(L, { teamName: 'Coaches', acceptUrl: 'https://meet.example/invite/inv_1' }),
});

// Phrases the English versions used; none may survive in another language.
const ENGLISH = [
  'did not answer', 'expired', 'Approval needed', 'requested', 'Declined', 'unable to confirm', 'is due',
  'Pay online', 'invited you', 'Sign in', 'Accept the invite', 'Accept invite', 'Reminder', 'Open the link', 'Note from', 'Hi ',
];

describe('Meet lifecycle mails — every one in English and Dutch', () => {
  for (const L of ['en', 'nl'] as const) {
    for (const [name, m] of Object.entries(all(L))) {
      it(`${L} ${name}: complete, no placeholders left`, () => {
        for (const part of [m.subject, m.text, m.title, m.bodyHtml]) {
          expect(part.length).toBeGreaterThan(0);
          expect(part).not.toMatch(/\{[a-z_]+\}/);
        }
        expect(m.text).toContain('— ');
      });
    }
  }

  for (const [name, m] of Object.entries(all('nl'))) {
    it(`nl ${name}: no English left`, () => {
      for (const phrase of ENGLISH) expect(`${m.subject}\n${m.text}\n${m.title}\n${m.bodyHtml}`).not.toContain(phrase);
    });
  }

  it('English reads as it did before (subjects)', () => {
    const en = all('en');
    expect(en.requestExpiredInvitee.subject).toBe('Your request expired: Intake');
    expect(en.requestExpiredHost.subject).toBe('Expired without an answer: Intake — Anna de Vries');
    expect(en.approvalNeededHost.subject).toBe('Approval needed: Intake — Anna de Vries');
    expect(en.approvalNeededHostMoved.subject).toBe('Approval needed (moved): Intake — Anna de Vries');
    expect(en.bookingDeclinedInvitee.subject).toBe('Declined: Intake');
    expect(en.paymentDueInvitee.subject).toBe('Payment for Intake');
    expect(en.teamInviteReminder.subject).toBe('Reminder: accept your invite to Coaches');
  });

  it('money in the reader’s format', () => {
    expect(meetMoney('en', 6000, 'eur')).toBe('€60.00');
    expect(meetMoney('nl', 6000, 'eur')).toBe('€ 60,00');
  });

  it('no first name → no greeting at all, never "Hi ,"', () => {
    const m = bookingDeclinedInvitee('en', { inviteeName: '', hostName: null, meeting: 'Intake', note: null });
    expect(m.text.startsWith('your host was unable')).toBe(true);
    expect(m.bodyHtml).not.toContain('Hi ');
  });

  it('every value is escaped in the html (the access invite used not to)', () => {
    const m = meetAccessInvite('en', { inviterName: '<b>Eve</b>', email: 'e@x.org', signInUrl: 'https://thefibre.app' });
    expect(m.bodyHtml).toContain('&lt;b&gt;Eve&lt;/b&gt;');
    expect(m.bodyHtml).not.toContain('<b>Eve</b>');
  });

  it('writes the nl + en renders for the reader of this PR', () => {
    const out: string[] = [];
    for (const L of ['en', 'nl'] as const) {
      for (const [name, m] of Object.entries(all(L))) {
        out.push(`===== ${L} · ${name}\nSUBJECT: ${m.subject}\nTITLE: ${m.title}\n--- text\n${m.text}\n--- html body\n${m.bodyHtml}\n`);
      }
    }
    const dir = process.env.MEET_MAIL_RENDER_OUT;
    if (dir) writeFileSync(dir, out.join('\n'));
    expect(out.length).toBe(18);
  });
});
