// The API and the form must refuse the same percentages.
//
// They share a function, so most of this passes by construction — which is
// exactly when the test earns its keep: it goes red the day somebody puts a
// `.min(1)` back into the route's schema, or widens the form, and the two
// drift apart with nobody noticing. The failure that shape produces is the
// one Membership has already had: a product promises a member something, the
// grant saves, and the member silently gets nothing.
//
// The last test reads the route source, because no type can say "the route
// still calls this".

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { teamCalendarGrantConfig } from '@thefibre/shared/team-calendar-grant';
import { parseTeamCalendarConfig, TEAM_CALENDAR_REFUSAL } from './grant-config.js';

const TEAM = '11111111-1111-1111-1111-111111111111';

describe('the grant API and the grant form agree about percentages', () => {
  const cases: { pct: unknown; accepted: boolean; stored?: number }[] = [
    { pct: undefined, accepted: true, stored: 100 }, // a blank field = included
    { pct: '', accepted: true, stored: 100 },
    { pct: 100, accepted: true, stored: 100 },
    { pct: '20', accepted: true, stored: 20 },
    { pct: 1, accepted: true, stored: 1 },
    { pct: 0, accepted: false },
    { pct: '0', accepted: false },
    { pct: 101, accepted: false },
    { pct: -1, accepted: false },
    { pct: 12.5, accepted: false },
    { pct: 'twenty', accepted: false },
  ];

  for (const c of cases) {
    const what = c.accepted ? `stored as ${c.stored}` : 'refused';
    it(`${JSON.stringify(c.pct)} → ${what}, on both sides`, () => {
      const form = teamCalendarGrantConfig(TEAM, c.pct as string | number | null | undefined);
      const api = parseTeamCalendarConfig({
        team_id: TEAM,
        ...(c.pct === undefined ? {} : { discount_pct: c.pct }),
      });
      expect(form.ok, 'the form').toBe(c.accepted);
      expect(api.ok, 'the API').toBe(c.accepted);
      if (c.accepted) {
        expect(form.ok && form.config.discount_pct, 'the form would store').toBe(c.stored);
        // The same NORMALISED number, so a grant written by a script and one
        // written by a person are the same row.
        expect(
          api.ok && (api.config as { discount_pct?: number }).discount_pct,
          'the API stores',
        ).toBe(c.stored);
      }
    });
  }

  it('no team: refused on both sides', () => {
    expect(teamCalendarGrantConfig('', 100).ok).toBe(false);
    expect(parseTeamCalendarConfig({ discount_pct: 100 }).ok).toBe(false);
  });

  it('a team id that is not a uuid: the API refuses what the form cannot see', () => {
    // The shared rule runs in a browser and only knows "there is a team". The
    // API carries the foreign key, so it is the one that must refuse an id
    // that cannot reference a row.
    expect(teamCalendarGrantConfig('team-b', 100).ok, 'the form cannot tell').toBe(true);
    const api = parseTeamCalendarConfig({ team_id: 'team-b', discount_pct: 100 });
    expect(api.ok, 'the API can').toBe(false);
    expect(!api.ok && api.message).toBe(TEAM_CALENDAR_REFUSAL.team);
  });

  it('the refusal says WHY, because a person reads it in the form', () => {
    const api = parseTeamCalendarConfig({ team_id: TEAM, discount_pct: 0 });
    expect(!api.ok && api.message).toContain('promises nothing');
  });

  it('and the route still validates through this, rather than its own copy', () => {
    const src = readFileSync(new URL('../routes/membership.ts', import.meta.url), 'utf8');
    expect(src, 'the route calls the shared bridge').toContain('parseTeamCalendarConfig(v.config)');
    // The old inline schema is gone, and must not come back beside it.
    expect(src).not.toContain('TeamCalendarConfig = z.object');
    expect(src, 'and the normalised config is what gets stored').toContain('v.config = parsed.config');
  });
});
