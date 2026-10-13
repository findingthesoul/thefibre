// "Nothing invoiced yet" must only ever mean there are none.
//
// This is the same rule the API side writes down in lib/rows.ts, on the
// client side of the same list. `fetchInvoices` used to catch everything and
// return `[]`, so a 500, an expired token and a member with no purchases all
// rendered the identical sentence — and on 2026-10-13 that turned a reported
// missing invoice into an hour of ruling things out, because the one surface
// that could have said "the call failed" was built never to say it.
//
// The row, the query and the endpoint all turned out to be fine that time.
// The point is that the page could not have told anybody so.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchInvoices, PortalApiError } from './portal-api';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchInvoices', () => {
  it('returns the items the API sent', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ items: [{ id: 'a' }, { id: 'b' }] })));
    const rows = await fetchInvoices('token');
    expect(rows.map((r) => r.id)).toEqual(['a', 'b']);
  });

  it('returns an empty list when the member genuinely has none', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ items: [] })));
    await expect(fetchInvoices('token')).resolves.toEqual([]);
  });

  // THE case. Red before 2026-10-13: this resolved to [] and the page said
  // "Nothing invoiced yet" to somebody who had just paid.
  it('throws on a server error instead of answering "none"', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ error: 'boom' }, 500)));
    await expect(fetchInvoices('token')).rejects.toBeInstanceOf(PortalApiError);
  });

  it('carries the status, so a log can say which failure it was', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ error: 'nope' }, 401)));
    await expect(fetchInvoices('token')).rejects.toMatchObject({ status: 401 });
  });

  it('lets a network failure through rather than hiding it as "none"', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('fetch failed');
      }),
    );
    await expect(fetchInvoices('token')).rejects.toThrow(/fetch failed/);
  });

  // A payload that is missing the key altogether is not a failure — an older
  // API answering `{}` has no invoices to report, and that IS none.
  it('treats a payload with no items as none, not as a failure', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({})));
    await expect(fetchInvoices('token')).resolves.toEqual([]);
  });
});
