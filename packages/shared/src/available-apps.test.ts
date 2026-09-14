import { describe, expect, it } from 'vitest';
import { buildAppList } from './available-apps.js';

const member = (slug: string) => ({ app: { slug } });
const active = (slug: string) => ({ deactivated_at: null, app: { slug } });

describe('buildAppList', () => {
  it('lists the platform always, and an app only when activated AND held', () => {
    const list = buildAppList({
      currentApp: 'fibre-platform',
      memberships: [member('the-thread'), member('fibre-meet')],
      workspaceApps: [active('the-thread'), { deactivated_at: '2026-01-01', app: { slug: 'fibre-meet' } }],
      env: {},
    });
    expect(list.map((a) => a.slug)).toEqual(['fibre-platform', 'the-thread']);
  });

  it('accepts the PostgREST array form of the embedded app row', () => {
    const list = buildAppList({
      currentApp: 'fibre-platform',
      memberships: [{ app: [{ slug: 'fibre-flow' }] }],
      workspaceApps: [{ deactivated_at: null, app: [{ slug: 'fibre-flow' }] }],
      env: {},
    });
    expect(list.map((a) => a.slug)).toContain('fibre-flow');
  });

  it('keeps a staging page on staging when given the serving host (the 2026-09-13 bug)', () => {
    const env = {
      NEXT_PUBLIC_FIBRE_URL: 'https://thefibre.tech',
      NEXT_PUBLIC_THREAD_URL: 'https://thread.thefibre.tech',
    };
    const list = buildAppList({
      currentApp: 'the-thread',
      memberships: [member('the-thread')],
      workspaceApps: [active('the-thread')],
      host: 'thread.thefibre.tech',
      env,
    });
    for (const a of list) expect(a.url, a.slug).not.toContain('thethread.app');
  });

  it('orders by the canonical display order, platform first', () => {
    const list = buildAppList({
      currentApp: 'fibre-platform',
      memberships: [member('fibre-pulse'), member('the-thread'), member('fibre-meet')],
      workspaceApps: [active('fibre-pulse'), active('the-thread'), active('fibre-meet')],
      env: {},
    });
    expect(list[0].slug).toBe('fibre-platform');
    expect(list.map((a) => a.slug).indexOf('the-thread')).toBeLessThan(
      list.map((a) => a.slug).indexOf('fibre-pulse'),
    );
  });
});
