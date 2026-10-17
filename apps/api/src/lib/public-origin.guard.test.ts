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
    expect(bare).toEqual(['bookings', 'invite', 'invite']);
  });

  it('routes/thread.ts builds no `${threadAppUrl()}/${…}` URL', () => {
    const src = read('routes/thread.ts');
    expect([...src.matchAll(/\$\{threadAppUrl\(\)\}\/\$\{/g)], 'an owner-rooted URL on the bare Thread origin').toHaveLength(0);
  });

  it('the lib builders and the portal use publicOriginFor', () => {
    // DIRECTLY, or through a helper that lives in public-origin.ts and does
    // it for them. `routes/portal.ts` stopped calling it by name on
    // 2026-10-14, when the thread-URL builder moved beside the resolver so
    // the could-join walk and the enrolments list would share one — the
    // indirection is the improvement, not a loophole.
    //
    // The hop is FOLLOWED rather than trusted: the case below asserts that
    // every helper exported from public-origin.ts resolves through
    // publicOriginFor, so "imports from public-origin" cannot become a way
    // to build a bare URL.
    for (const f of ['lib/calendar-feed.ts', 'lib/thread-payment-link.ts', 'lib/meet-payment-link.ts', 'routes/portal.ts', 'routes/purchases.ts']) {
      const src = read(f);
      const direct = src.includes('publicOriginFor(');
      const viaHelper = /from '\.\.?\/(lib\/)?public-origin\.js'/.test(src);
      expect(direct || viaHelper, `${f}: builds owner-rooted URLs on neither`).toBe(true);
    }
  });

  it('every URL helper in public-origin.ts resolves through publicOriginFor', () => {
    // The hop the case above allows. A helper there that interpolated an app
    // origin itself would let a caller satisfy that check while building
    // exactly the URL this whole guard exists to prevent.
    const src = read('lib/public-origin.ts');
    const helpers = [...src.matchAll(/export async function (\w*Url)\s*\(/g)].map((m) => m[1]);
    expect(helpers.length, 'no URL helpers found — has the file moved?').toBeGreaterThan(0);
    for (const name of helpers) {
      const start = src.indexOf(`export async function ${name}`);
      const body = src.slice(start, src.indexOf('\n}', start));
      expect(body, `${name} must resolve the owner's origin`).toContain('publicOriginFor(');
    }
  });
});
