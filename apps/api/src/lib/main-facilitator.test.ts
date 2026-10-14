import { describe, expect, it } from 'vitest';
import { sessionsToMove } from './main-facilitator.js';

// The two guards that decide WHICH sessions a room change rewrites (the
// approved design, 2026-10-14): (a) future sessions only; (b) only
// personal-room sessions whose stored URL is the OLD room.
const now = new Date('2026-11-01T12:00:00Z');
const OLD = 'https://meet.example/old-room';
const row = (over: Partial<{ meeting_provider: string | null; meeting_url: string | null; starts_at: string | null }>) => ({
  meeting_provider: 'personal_room' as string | null,
  meeting_url: OLD as string | null,
  starts_at: '2026-11-08T10:00:00Z' as string | null,
  ...over,
});

describe('which sessions a room change moves', () => {
  it('a future personal-room session in the old room moves', () => {
    expect(sessionsToMove([row({})], OLD, now)).toHaveLength(1);
  });
  it('(a) a past session keeps its room — it is history', () => {
    expect(sessionsToMove([row({ starts_at: '2026-10-25T10:00:00Z' })], OLD, now)).toEqual([]);
  });
  it('(a) a session with no date is not moved', () => {
    expect(sessionsToMove([row({ starts_at: null })], OLD, now)).toEqual([]);
  });
  it('(b) a link somebody typed over the room is never overwritten', () => {
    expect(sessionsToMove([row({ meeting_url: 'https://meet.example/a-special-room' })], OLD, now)).toEqual([]);
  });
  it('(b) Zoom / Meet / custom sessions are never touched, even on the same URL', () => {
    for (const p of ['zoom', 'google_meet', 'custom', null]) {
      expect(sessionsToMove([row({ meeting_provider: p })], OLD, now), String(p)).toEqual([]);
    }
  });
  it('a session saved while the account had no room gets one when they add it', () => {
    expect(sessionsToMove([row({ meeting_url: null })], null, now)).toHaveLength(1);
  });
});
