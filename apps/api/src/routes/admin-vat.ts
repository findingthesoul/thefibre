// /api/v1/admin/vat — the operator's VAT rate table (super admin).
// Read + replace whole config; the editor at /admin/vat is the only writer.

import { Hono } from 'hono';
import { z } from 'zod';
import { getVatRates, setVatRates } from '../lib/vat.js';
import { syncVatRatesFromStripe, lastVatSync } from '../lib/vat-sync.js';
import { isSuperAdminUser } from '../lib/super-admin.js';

export const adminVatRoutes = new Hono();

adminVatRoutes.get('/', async (c) => {
  const ctx = c.get('ctx');
  if (!(await isSuperAdminUser(ctx))) return c.json({ error: 'super admin required' }, 403);
  const [rates, sync] = await Promise.all([getVatRates(), lastVatSync()]);
  return c.json({ ...rates, last_sync: sync });
});

// The magic, on demand: probe Stripe Tax per country, apply + report drift.
adminVatRoutes.post('/sync', async (c) => {
  const ctx = c.get('ctx');
  if (!(await isSuperAdminUser(ctx))) return c.json({ error: 'super admin required' }, 403);
  const log = await syncVatRatesFromStripe();
  return c.json(log);
});

const Body = z.object({
  home_country: z.string().regex(/^[A-Z]{2}$/),
  eu_b2b_reverse_charge: z.boolean(),
  rates: z.record(z.string().regex(/^[A-Z]{2}$/), z.number().min(0).max(50)),
});

adminVatRoutes.put('/', async (c) => {
  const ctx = c.get('ctx');
  if (!(await isSuperAdminUser(ctx))) return c.json({ error: 'super admin required' }, 403);
  const body = Body.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  if (!(body.data.home_country in body.data.rates)) {
    return c.json({ error: 'home_country must have a rate' }, 400);
  }
  await setVatRates(body.data);
  return c.json({ ok: true });
});
