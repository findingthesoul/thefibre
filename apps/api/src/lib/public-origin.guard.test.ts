// The guard Meet's chat asked for (2026-10-06): no owner-rooted public URL
// may be built on the bare app origin any more. An URL under `/{root}/…`
// belongs to an owner, and an owner may have their own host; `/my`,
// `/invite`, `/certificate`, `/checkin` do not, and stay on the app's own.
//
// Read as text: the pattern `${meetAppUrl()}/${` (origin, slash, an
// interpolated slug) is exactly an owner-rooted URL on the bare origin.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const here = resolve(import.meta.dirname, '..');
const read = (p: string) => readFileSync(resolve(here, p), 'utf8');

describe('owner-rooted public URLs go through publicOriginFor', () => {
  it('routes/meet.ts builds no `${meetAppUrl()}/${…}` URL', () => {
    const src = read('routes/meet.ts');
    const hits = [...src.matchAll(/\$\{meetAppUrl\(\)\}\/\$\{/g)];
    expect(hits, 'an owner-rooted URL on the bare Meet origin').toHaveLength(0);
    // The template fields hand the origin to lib/email/templates.ts, which
    // builds `/{host}/{mt}/…` from it: the field itself may not be bare.
    expect(src).not.toMatch(/meetAppUrl:\s*meetAppUrl\(\)/);
    // The bare calls that remain are the ones that SHOULD stay on our own
    // origin: the host's signed-in area and the invite accept page, both of
    // which the tenant middleware sends to the canonical origin anyway. A
    // new bare call has to be argued for here, not just added (Meet's chat,
    // 2026-10-06).
    const bare = [...src.matchAll(/\$\{meetAppUrl\(\)\}\/([a-z-]+)/g)].map((m) => m[1]).sort();
    expect(bare).toEqual(['bookings', 'bookings', 'invite', 'invite']);
  });

  it('routes/thread.ts builds no `${threadAppUrl()}/${…}` URL', () => {
    const src = read('routes/thread.ts');
    expect([...src.matchAll(/\$\{threadAppUrl\(\)\}\/\$\{/g)], 'an owner-rooted URL on the bare Thread origin').toHaveLength(0);
  });

  it('the lib builders and the portal use publicOriginFor', () => {
    for (const f of ['lib/calendar-feed.ts', 'lib/thread-payment-link.ts', 'lib/meet-payment-link.ts', 'routes/portal.ts', 'routes/purchases.ts']) {
      expect(read(f), f).toContain('publicOriginFor(');
    }
  });
});
