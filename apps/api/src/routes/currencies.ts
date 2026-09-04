import { Hono } from 'hono';

// ECB daily reference rates, for indicative currency display. Sjoerd's
// question (2026-09-05): "is there a permanent trustworthy source?" — yes,
// the ECB's daily reference rates, the ones banks quote against. Served
// via the Frankfurter mirror (open, keyless, ECB data verbatim). Not
// intraday, refreshed ~16:00 CET — exactly right for "≈ €93" hints and
// deliberately NOT for charging: money always charges in the currency it
// was priced in (the vat-stripe rule's sibling: rails don't do arithmetic
// on amounts we show people).

export const currenciesRoutes = new Hono();

type Rates = { base: string; date: string; rates: Record<string, number> };
let cache: { data: Rates; at: number } | null = null;
const TTL_MS = 12 * 60 * 60 * 1000;

currenciesRoutes.get('/rates', async (c) => {
  if (cache && Date.now() - cache.at < TTL_MS) return c.json(cache.data);
  try {
    const res = await fetch('https://api.frankfurter.app/latest?from=EUR', {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`frankfurter ${res.status}`);
    const body = (await res.json()) as { base: string; date: string; rates: Record<string, number> };
    cache = { data: { base: body.base, date: body.date, rates: body.rates }, at: Date.now() };
    return c.json(cache.data);
  } catch (e) {
    console.warn('[currencies] ECB rates fetch failed', e);
    // Stale cache beats nothing; nothing beats an error (display-only data).
    if (cache) return c.json(cache.data);
    return c.json({ base: 'EUR', date: null, rates: {} });
  }
});
