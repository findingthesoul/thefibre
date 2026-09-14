// GET /api/v1/public/plans — the catalogue, signed out.
//
// The public /pricing page on thefibre.app renders this. Same billing_plan
// rows the gates and the admin matrix use, so the website can never promise
// something enforcement disagrees with. Catalogue only: no workspace, no
// usage, no PII — safe to serve without auth (listed in PUBLIC_PATHS, GET
// only). The web app fetches it server-side, so CORS stays untouched.

import { Hono } from 'hono';
import { publicCatalogue } from '../lib/plan.js';
import { autoApproveSignups } from '../lib/platform-settings.js';

export const publicPlansRoutes = new Hono();

publicPlansRoutes.get('/', async (c) => {
  let plans;
  try {
    plans = await publicCatalogue();
  } catch (e) {
    console.error('[public-plans GET]', e);
    return c.json({ error: 'unavailable' }, 500);
  }
  // Cache at the edge for a few minutes — prices change rarely and this is
  // unauthenticated read traffic on the marketing page. (The API holds the
  // rows in-process for a minute as well; see publicCatalogue.)
  c.header('Cache-Control', 'public, max-age=300');
  return c.json({
    plans,
    // The marketing pages read this to choose their story: 'open' = sign up
    // now (auto-approve on, the default); 'invited' = request-access copy.
    signup_mode: (await autoApproveSignups()) ? 'open' : 'invited',
  });
});
