// The rule that decides whose meetings somebody sees. Worth a test of its own
// because getting it wrong in either direction is a real harm: too wide and
// the app reads a private calendar nobody offered it, too narrow and Today is
// silently empty and looks broken.

import { describe, expect, it } from 'vitest';
import { isOwned, resolveCalendars, type GoogleCalendar } from './agenda-calendars.js';

const cal = (over: Partial<GoogleCalendar> & { id: string }): GoogleCalendar => ({
  summary: over.id,
  primary: false,
  accessRole: 'owner',
  ...over,
});

describe('what counts as your own', () => {
  it('is owner and writer, not reader', () => {
    expect(isOwned('owner')).toBe(true);
    expect(isOwned('writer')).toBe(true);
    expect(isOwned('reader')).toBe(false);
    expect(isOwned('freeBusyReader')).toBe(false);
    expect(isOwned(null)).toBe(false);
  });
});

describe('with nothing stored', () => {
  const all = [
    cal({ id: 'me@example.org', primary: true }),
    cal({ id: 'team@example.org', accessRole: 'writer' }),
    cal({ id: 'holidays', accessRole: 'reader' }),
  ];

  it('reads the calendars you own and leaves subscriptions alone', () => {
    const out = resolveCalendars(all, new Map());
    expect(out.filter((c) => c.enabled).map((c) => c.id)).toEqual([
      'me@example.org',
      'team@example.org',
    ]);
  });

  it('says nobody has chosen yet, so the picker can say so too', () => {
    expect(resolveCalendars(all, new Map()).every((c) => !c.chosen)).toBe(true);
  });

  it('puts your primary first, then your own, then the ones you follow', () => {
    const out = resolveCalendars(
      [
        cal({ id: 'zed', summary: 'Zed', accessRole: 'reader' }),
        cal({ id: 'abc', summary: 'Abc' }),
        cal({ id: 'mine', summary: 'Mine', primary: true }),
      ],
      new Map(),
    );
    expect(out.map((c) => c.id)).toEqual(['mine', 'abc', 'zed']);
  });
});

describe('with a choice stored', () => {
  const all = [
    cal({ id: 'me@example.org', primary: true }),
    cal({ id: 'private@example.org' }),
    cal({ id: 'holidays', accessRole: 'reader' }),
  ];

  it('switches off a calendar you own', () => {
    const out = resolveCalendars(all, new Map([['private@example.org', false]]));
    expect(out.find((c) => c.id === 'private@example.org')!.enabled).toBe(false);
    expect(out.find((c) => c.id === 'private@example.org')!.chosen).toBe(true);
    // And leaves the untouched ones at their default.
    expect(out.find((c) => c.id === 'me@example.org')!.enabled).toBe(true);
  });

  it('switches on one you only subscribe to', () => {
    const out = resolveCalendars(all, new Map([['holidays', true]]));
    expect(out.find((c) => c.id === 'holidays')!.enabled).toBe(true);
  });

  it('lets somebody switch everything off', () => {
    const off = new Map(all.map((c) => [c.id, false] as const));
    expect(resolveCalendars(all, off).filter((c) => c.enabled)).toEqual([]);
  });

  it('ignores a stored row for a calendar that is gone', () => {
    const out = resolveCalendars(all, new Map([['deleted-at-google', true]]));
    expect(out.map((c) => c.id)).not.toContain('deleted-at-google');
  });

  it('gives a calendar made after the choice its default', () => {
    const chosen = new Map(all.map((c) => [c.id, false] as const));
    const withNew = [...all, cal({ id: 'brand-new' })];
    expect(resolveCalendars(withNew, chosen).find((c) => c.id === 'brand-new')!.enabled).toBe(true);
  });
});
