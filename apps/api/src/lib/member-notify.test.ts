import { describe, expect, it } from 'vitest';
import { QUIET_MS, readyForDigest } from './member-notify.js';
import { memberNotifyDigest } from './email/member-notify-templates.js';

// ONE EMAIL PER SITTING. An organiser loading a year's agenda makes thirty
// rows in a few minutes; the email waits until the person's NEWEST row is a
// quarter of an hour old, so all thirty go in one. `now` is an argument.
describe('readyForDigest — the quiet window', () => {
  const now = new Date('2026-10-14T12:00:00Z');
  const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();

  it('waits while the newest row is younger than the window, even if older ones are not', () => {
    const rows = [
      { person_id: 'a', created_at: ago(QUIET_MS * 3) },
      { person_id: 'a', created_at: ago(QUIET_MS - 1000) },
    ];
    expect(readyForDigest(rows, now).has('a')).toBe(false);
  });

  it('sends once the newest row has been quiet for the whole window', () => {
    const rows = [
      { person_id: 'a', created_at: ago(QUIET_MS * 2) },
      { person_id: 'a', created_at: ago(QUIET_MS) },
    ];
    expect(readyForDigest(rows, now).has('a')).toBe(true);
  });

  it('decides per person', () => {
    const rows = [
      { person_id: 'a', created_at: ago(QUIET_MS + 1) },
      { person_id: 'b', created_at: ago(1000) },
    ];
    expect([...readyForDigest(rows, now)]).toEqual(['a']);
  });
});

describe('memberNotifyDigest — the email', () => {
  const base = {
    name: 'Marja',
    communityName: 'Choir',
    upcomingUrl: 'https://my.example/upcoming',
    unsubscribeUrl: 'https://my.example/unsubscribe/abc',
    locale: 'en',
  };

  it('lists every new thread with its date and THIS member’s price, in one message', () => {
    const m = memberNotifyDigest({
      ...base,
      items: [
        { kind: 'new_thread', title: 'Open rehearsal', startsAt: '2026-10-24', yourPriceCents: 0, listPriceCents: 5000, currency: 'EUR' },
        { kind: 'new_thread', title: 'Weekend', startsAt: '2026-11-13', yourPriceCents: 4000, listPriceCents: 5000, currency: 'EUR' },
      ],
    });
    expect(m.subject).toBe('Choir: new on the calendar');
    expect(m.text).toContain('Open rehearsal');
    expect(m.text).toContain('included in your membership');
    expect(m.text).toContain('€40.00 instead of €50.00');
    expect(m.html).toContain('https://my.example/upcoming');
    // The way out is in every email.
    expect(m.html).toContain('https://my.example/unsubscribe/abc');
    expect(m.text).toContain('Stop these emails: https://my.example/unsubscribe/abc');
  });

  it('a changes-only email says "Changes" and shows moved and cancelled sessions', () => {
    const m = memberNotifyDigest({
      ...base,
      items: [
        { kind: 'session_moved', title: 'Weekend · Day 1', startsAt: '2026-11-14T09:00:00Z' },
        { kind: 'session_cancelled', title: 'Weekend · Day 2', startsAt: '2026-11-15T09:00:00Z' },
      ],
    });
    expect(m.subject).toBe('Choir: changes on the calendar');
    expect(m.text).toContain('Weekend · Day 1 — now');
    expect(m.text).toContain('cancelled');
  });

  it('escapes what organisers typed', () => {
    const m = memberNotifyDigest({
      ...base,
      items: [{ kind: 'session_moved', title: '<script>x</script>', startsAt: null }],
    });
    expect(m.html).not.toContain('<script>x</script>');
  });
});
