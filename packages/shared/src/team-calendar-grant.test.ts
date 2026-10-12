// The percentage rule, pinned here because three places depend on it: the
// product dialog, the tier Access dialog, and the API's zod schema. The API
// has its own test asserting it agrees with THIS one — the offer and the
// enforcement sharing code is the point (design: offer and enforcement share
// code).

import { describe, expect, it } from 'vitest';
import {
  teamCalendarGrantConfig,
  teamCalendarPctCase,
  teamCalendarPctRefusal,
} from './team-calendar-grant.js';

const TEAM = '11111111-1111-1111-1111-111111111111';

describe('teamCalendarGrantConfig', () => {
  it('a blank percentage means 100 — the calendar is included', () => {
    expect(teamCalendarGrantConfig(TEAM, '')).toEqual({
      ok: true,
      config: { team_id: TEAM, discount_pct: 100 },
    });
    expect(teamCalendarGrantConfig(TEAM, null)).toEqual({
      ok: true,
      config: { team_id: TEAM, discount_pct: 100 },
    });
    expect(teamCalendarGrantConfig(TEAM)).toEqual({
      ok: true,
      config: { team_id: TEAM, discount_pct: 100 },
    });
  });

  it('but ZERO does not mean 100, and is refused with its own reason', () => {
    // The whole point: a blank field lands on "included", a typed 0 lands on
    // "you promised nothing". Reading 0 as 100 would turn a nonsense grant
    // into a free calendar; reading blank as 0 would refuse the common case.
    expect(teamCalendarGrantConfig(TEAM, 0)).toEqual({ ok: false, reason: 'zero' });
    expect(teamCalendarGrantConfig(TEAM, '0')).toEqual({ ok: false, reason: 'zero' });
    expect(teamCalendarGrantConfig(TEAM, '  0 ')).toEqual({ ok: false, reason: 'zero' });
  });

  it('takes a number or the string a form holds', () => {
    expect(teamCalendarGrantConfig(TEAM, 20)).toEqual({
      ok: true,
      config: { team_id: TEAM, discount_pct: 20 },
    });
    expect(teamCalendarGrantConfig(TEAM, ' 20 ')).toEqual({
      ok: true,
      config: { team_id: TEAM, discount_pct: 20 },
    });
  });

  it('refuses a percentage that is not a whole number between 1 and 100', () => {
    expect(teamCalendarGrantConfig(TEAM, 101).ok).toBe(false);
    expect(teamCalendarGrantConfig(TEAM, -5).ok).toBe(false);
    expect(teamCalendarGrantConfig(TEAM, 12.5)).toEqual({ ok: false, reason: 'range' });
    expect(teamCalendarGrantConfig(TEAM, 'twenty')).toEqual({ ok: false, reason: 'not_a_number' });
  });

  it('refuses a grant with no team, whatever the percentage', () => {
    expect(teamCalendarGrantConfig('', 50)).toEqual({ ok: false, reason: 'team' });
    expect(teamCalendarGrantConfig('   ', 100)).toEqual({ ok: false, reason: 'team' });
    expect(teamCalendarGrantConfig(null, 100)).toEqual({ ok: false, reason: 'team' });
  });

  it('trims the team id rather than storing a padded one', () => {
    const r = teamCalendarGrantConfig(` ${TEAM} `, 100);
    expect(r.ok && r.config.team_id).toBe(TEAM);
  });
});

describe('which sentence a percentage gets', () => {
  it('100, and a blank field, read as free for members', () => {
    expect(teamCalendarPctCase(100)).toBe('free');
    expect(teamCalendarPctCase('')).toBe('free');
  });
  it('1 to 99 read as a partial discount', () => {
    expect(teamCalendarPctCase(1)).toBe('partial');
    expect(teamCalendarPctCase(99)).toBe('partial');
  });
  it('and the refused ones say which refusal, with no team in hand', () => {
    expect(teamCalendarPctCase(0)).toBe('invalid');
    expect(teamCalendarPctRefusal(0)).toBe('zero');
    expect(teamCalendarPctRefusal(150)).toBe('range');
    expect(teamCalendarPctRefusal('abc')).toBe('not_a_number');
    expect(teamCalendarPctRefusal(100), 'nothing wrong with 100').toBeNull();
    expect(teamCalendarPctRefusal(''), 'nor with a blank field').toBeNull();
  });
});
