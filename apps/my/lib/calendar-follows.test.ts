import { describe, expect, it } from 'vitest';
import { feedIsFollowed } from './calendar-follows';

const NOW = new Date('2026-10-17T12:00:00Z');

describe('feedIsFollowed — the calendar window\'s rule', () => {
  it('a live feed read within 14 days is followed', () => {
    expect(feedIsFollowed({ subscribed: true, last_read_at: '2026-10-16T08:00:00Z' }, NOW)).toBe(true);
  });
  it('exactly 14 days is still followed (the window uses gte)', () => {
    expect(feedIsFollowed({ subscribed: true, last_read_at: '2026-10-03T12:00:00Z' }, NOW)).toBe(true);
  });
  it('a moment past 14 days is not', () => {
    expect(feedIsFollowed({ subscribed: true, last_read_at: '2026-10-03T11:59:59Z' }, NOW)).toBe(false);
  });
  it('never read is not followed', () => {
    expect(feedIsFollowed({ subscribed: true, last_read_at: null }, NOW)).toBe(false);
  });
  it('a stopped (revoked) feed is not followed, whatever it says about reads', () => {
    expect(feedIsFollowed({ subscribed: false, last_read_at: '2026-10-16T08:00:00Z' }, NOW)).toBe(false);
  });
  it('an unreadable date is not followed', () => {
    expect(feedIsFollowed({ subscribed: true, last_read_at: 'not a date' }, NOW)).toBe(false);
  });
});
