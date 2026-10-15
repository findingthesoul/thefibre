// The frame must render when /me/nav is missing.
//
// my.thread's layout reads GET /me/nav (v1.215.0). The web apps and the API
// deploy separately — on production, batch-prod promotes the web apps first
// — so for a few minutes after a release this page can be newer than the API
// it calls, and a missing route used to mean the error page on every page.
// So: nav answers → use it; nav missing or failing → the same three values
// from /me/portal; a refused session → stay a 401, which is "signed out".

import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchNav, PortalApiError } from './portal-api';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const PORTAL = { person: {}, groups: [], upcoming: true, communities: 2, unread_notifications: 3 };

afterEach(() => {
  vi.unstubAllGlobals();
});

function stub(nav: Response) {
  const calls: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      calls.push(String(url));
      return String(url).endsWith('/me/nav') ? nav : json(PORTAL);
    }),
  );
  return calls;
}

describe('fetchNav', () => {
  it('uses /me/nav when the API has it, and asks nothing else', async () => {
    const calls = stub(json({ upcoming: false, communities: 1, unread_notifications: 0 }));
    await expect(fetchNav('t')).resolves.toEqual({ upcoming: false, communities: 1, unread_notifications: 0 });
    expect(calls.filter((u) => u.endsWith('/me/portal'))).toHaveLength(0);
  });

  it('falls back to /me/portal when /me/nav does not exist yet (an older API)', async () => {
    const calls = stub(json({ error: 'not found' }, 404));
    await expect(fetchNav('t')).resolves.toEqual({ upcoming: true, communities: 2, unread_notifications: 3 });
    expect(calls.some((u) => u.endsWith('/me/portal'))).toBe(true);
  });

  it('falls back on a server error too', async () => {
    stub(json({ error: 'boom' }, 500));
    await expect(fetchNav('t')).resolves.toEqual({ upcoming: true, communities: 2, unread_notifications: 3 });
  });

  it('keeps a refused session a 401, so the page says "sign in" rather than guessing', async () => {
    const calls = stub(json({ error: 'sign in required' }, 401));
    await expect(fetchNav('t')).rejects.toMatchObject({ status: 401 });
    await expect(fetchNav('t')).rejects.toBeInstanceOf(PortalApiError);
    expect(calls.some((u) => u.endsWith('/me/portal'))).toBe(false);
  });
});
