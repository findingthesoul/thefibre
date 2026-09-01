// GET /api/v1/public/plans — the catalogue, signed out.
//
// The public /pricing page on thefibre.app renders this. Same billing_plan
// rows the gates and the admin matrix use, so the website can never promise
// something enforcement disagrees with. Catalogue only: no workspace, no
// usage, no PII — safe to serve without auth (listed in PUBLIC_PATHS, GET
// only). The web app fetches it server-side, so CORS stays untouched.

import { Hono } from 'hono';
import { adminClient } from '../db.js';

export const publicPlansRoutes = new Hono();

publicPlansRoutes.get('/', async (c) => {
  const { data, error } = await adminClient
    .from('billing_plan')
    .select(
      'id, name, price_cents_month, price_cents_year, included_seats, extra_seat_cents_month, included_emails_month, included_storage_gb, retention_months, meet_paid_pct, meet_paid_cap_cents, features',
    )
    .order('price_cents_month');
  if (error) {
    console.error('[public-plans GET]', error);
    return c.json({ error: 'unavailable' }, 500);
  }
  // Cache at the edge for a few minutes — prices change rarely and this is
  // unauthenticated read traffic on the marketing page.
  c.header('Cache-Control', 'public, max-age=300');
  return c.json({ plans: data ?? [] });
});
