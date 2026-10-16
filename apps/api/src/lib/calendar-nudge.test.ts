// The nudge's pure decisions (the claim and the clock are in
// integration/calendar-nudge.int.test.ts).

import { describe, expect, it, vi } from 'vitest';

vi.mock('../db.js', () => ({ adminClient: {} }));

const { inNudgeWindow, stillMatters, NUDGE_AFTER_MS, NUDGE_UNTIL_MS } = await import('./calendar-nudge.js');
const { calendarNudgeEmail, NUDGE_TITLES_SHOWN } = await import('./email/thread-templates.js');

const now = new Date('2026-10-16T12:00:00Z');
const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();

describe('inNudgeWindow', () => {
  it('a day, to the millisecond, is due; a moment less is not', () => {
    expect(inNudgeWindow(ago(NUDGE_AFTER_MS), now)).toBe(true);
    expect(inNudgeWindow(ago(NUDGE_AFTER_MS - 1), now)).toBe(false);
  });
  it('a week is left alone; a moment less is still due', () => {
    expect(inNudgeWindow(ago(NUDGE_UNTIL_MS), now)).toBe(false);
    expect(inNudgeWindow(ago(NUDGE_UNTIL_MS - 1), now)).toBe(true);
  });
});

describe('stillMatters', () => {
  const at = (iso: string | null) => ({ starts_at: iso, ends_at: null });
  it('a session still to come matters; one that is over does not', () => {
    expect(stillMatters({ was: null, now_state: at('2026-10-20T10:00:00Z') }, now)).toBe(true);
    expect(stillMatters({ was: null, now_state: at('2026-10-10T10:00:00Z') }, now)).toBe(false);
  });
  it('a cancellation is judged by the session as it was', () => {
    expect(stillMatters({ was: at('2026-10-20T10:00:00Z'), now_state: null }, now)).toBe(true);
  });
  it('an undated change still counts', () => {
    expect(stillMatters({ was: null, now_state: null }, now)).toBe(true);
  });
});

describe('calendarNudgeEmail', () => {
  const base = { threadTitle: 'Year agenda', url: 'https://thread.example/threads/t1' };
  it('names the thread, counts the changes and links to the SEND, never sending itself', () => {
    const m = calendarNudgeEmail({ ...base, count: 2, titles: ['Day 1', 'Day 2'] });
    expect(m.subject).toBe('Not sent yet: changes to Year agenda');
    expect(m.text).toContain('You changed 2 sessions of Year agenda');
    expect(m.text).toContain('- Day 1');
    expect(m.text).toContain('Review and send: https://thread.example/threads/t1');
    expect(m.text).toContain('This is the only reminder about these changes.');
  });
  it('names five and counts the rest', () => {
    const titles = Array.from({ length: 8 }, (_, i) => `Day ${i + 1}`);
    const m = calendarNudgeEmail({ ...base, count: 8, titles });
    expect(NUDGE_TITLES_SHOWN).toBe(5);
    expect(m.text).toContain('- Day 5');
    expect(m.text).not.toContain('- Day 6');
    expect(m.text).toContain('- and 3 more');
  });
  it('in the organiser’s language', () => {
    expect(calendarNudgeEmail({ ...base, count: 1, titles: ['Dag 1'], locale: 'nl' }).subject).toBe(
      'Nog niet verstuurd: wijzigingen in Year agenda',
    );
  });
  it('escapes a title', () => {
    expect(calendarNudgeEmail({ ...base, count: 1, titles: ['<b>x</b>'] }).html).not.toContain('<b>x</b>');
  });
});
