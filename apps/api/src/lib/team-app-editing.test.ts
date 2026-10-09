// The rule both halves call. Worth its own test because the whole point of
// pulling it out was that two copies would disagree — a test that restated it
// would be a third copy and would pass whatever the route did.

import { describe, expect, it } from 'vitest';
import { mayEditTeamApps, teamAppsRefusal } from './team-app-editing.js';

describe('who may edit a team’s apps', () => {
  it('lets a Free workspace edit the automatic teams — that is the baseline, not a feature', () => {
    expect(mayEditTeamApps({ automatic: 'everyone' }, false)).toBe(true);
    expect(mayEditTeamApps({ automatic: 'admins' }, false)).toBe(true);
  });

  it('keeps custom teams behind the plan', () => {
    expect(mayEditTeamApps({ automatic: null }, false)).toBe(false);
    expect(mayEditTeamApps({}, false)).toBe(false);
  });

  it('lets a paid workspace edit everything', () => {
    expect(mayEditTeamApps({ automatic: null }, true)).toBe(true);
    expect(mayEditTeamApps({ automatic: 'everyone' }, true)).toBe(true);
  });

  // A string nobody has added yet must not read as "automatic, so free".
  // `automatic` is a database column; a third kind would arrive here before
  // anybody thought about what it should cost.
  it('treats an unknown automatic kind as a custom team', () => {
    expect(mayEditTeamApps({ automatic: 'something-new' }, false)).toBe(false);
  });

  it('refuses with a reason only when it refuses', () => {
    expect(teamAppsRefusal({ automatic: null }, false)).toBe('Giving teams app access');
    expect(teamAppsRefusal({ automatic: 'everyone' }, false)).toBeNull();
    expect(teamAppsRefusal({ automatic: null }, true)).toBeNull();
  });
});
