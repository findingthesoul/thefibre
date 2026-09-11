import { describe, it, expect } from 'vitest';
import { applyBetaExpiry } from './plan.js';

// The whole promise of the Beta tier is "for a while". A date that is stored
// and never read is the failure mode already sitting next to this one —
// comped_until — so the expiry gets tests rather than trust.
const T = Date.parse('2026-09-12T12:00:00Z');

describe('applyBetaExpiry', () => {
  it('leaves beta access alone when there is no end date', () => {
    const out = applyBetaExpiry({ beta_apps: true }, null, T);
    expect(out.beta_apps).toBe(true);
  });

  it('leaves beta access alone before the end date', () => {
    const out = applyBetaExpiry({ beta_apps: true }, '2026-12-01T00:00:00Z', T);
    expect(out.beta_apps).toBe(true);
  });

  it('withdraws beta access after the end date', () => {
    const out = applyBetaExpiry({ beta_apps: true }, '2026-08-01T00:00:00Z', T);
    expect(out.beta_apps).toBe(false);
  });

  it('withdraws NOTHING else — the rest of the plan stands', () => {
    const out = applyBetaExpiry(
      { beta_apps: true, sso: true, flow: true, thread_live_limit: null },
      '2026-08-01T00:00:00Z',
      T,
    );
    expect(out).toMatchObject({ sso: true, flow: true, thread_live_limit: null });
    expect(out.beta_apps).toBe(false);
  });

  it('does not mutate the features it was given', () => {
    const features = { beta_apps: true };
    applyBetaExpiry(features, '2026-08-01T00:00:00Z', T);
    expect(features.beta_apps).toBe(true);
  });

  it('ignores an end date on a plan that never had beta access', () => {
    const out = applyBetaExpiry({ sso: true }, '2026-08-01T00:00:00Z', T);
    expect(out.beta_apps).toBeUndefined();
    expect(out.sso).toBe(true);
  });

  it('keeps access when the date is unreadable rather than guessing', () => {
    const out = applyBetaExpiry({ beta_apps: true }, 'not a date', T);
    expect(out.beta_apps).toBe(true);
  });

  it('treats the exact moment as still inside the window', () => {
    const out = applyBetaExpiry({ beta_apps: true }, new Date(T).toISOString(), T);
    expect(out.beta_apps).toBe(true);
  });
});
