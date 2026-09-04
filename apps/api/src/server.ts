import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';
import { hit, clientIp } from './lib/rate-limit.js';
import { appContext } from './middleware/app-context.js';
import { authRoutes } from './routes/auth.js';
import { personsRoutes } from './routes/persons.js';
import { organisationsRoutes } from './routes/organisations.js';
import { activitiesRoutes } from './routes/activities.js';
import { programsRoutes } from './routes/programs.js';
import { privacyRoutes } from './routes/privacy.js';
import { ssoRoutes } from './routes/sso.js';
import { signupRequestsRoutes } from './routes/signup-requests.js';
import { workspaceAppsRoutes } from './routes/workspace-apps.js';
import { workspacesRoutes } from './routes/workspaces.js';
import { meetRoutes } from './routes/meet.js';
import { flowRoutes } from './routes/flow.js';
import { pulseRoutes } from './routes/pulse.js';
import { membershipRoutes } from './routes/membership.js';
import { teamsRoutes } from './routes/teams.js';
import { threadRoutes, runThreadMessageScheduler } from './routes/thread.js';
import { membersRoutes } from './routes/members.js';
import { purchasesRoutes } from './routes/purchases.js';
import { workspaceBillingRoutes } from './routes/workspace-billing.js';
import { workspaceBrandRoutes } from './routes/workspace-brand.js';
import { planRoutes } from './routes/plan.js';
import { adminPlansRoutes } from './routes/admin-plans.js';
import { publicPlansRoutes } from './routes/public-plans.js';
import { billingRoutes } from './routes/billing.js';
import { adminEconomicsRoutes } from './routes/admin-economics.js';
import { adminSettingsRoutes } from './routes/admin-settings.js';
import { adminVatRoutes } from './routes/admin-vat.js';
import { uploadRoutes } from './routes/uploads.js';
import { profileRoutes } from './routes/profile.js';
import { appsRoutes } from './routes/apps.js';
import { authHookRoutes } from './routes/auth-hook.js';
import { maybeSyncVatRates } from './lib/vat-sync.js';
import { ensureStripeTaxRates } from './lib/vat-stripe.js';

const app = new Hono();

app.use('*', logger());

// CORS allowlist.
//
// Default-deny: only origins that match the workspace's subdomains and
// optional dev hosts are reflected back. A reflective fallback to "*"
// would defeat the purpose of credentials:true (browsers reject the
// combination anyway), so we just don't set Access-Control-Allow-Origin
// when the origin isn't recognised — the browser blocks the cross-site
// request cleanly.
//
// Configurable via `CORS_ORIGINS` (comma-separated) for staging / extra
// preview deploys. Empty `origin` (server-to-server, same-origin, native
// fetch) is always allowed.
const PROD_ORIGINS = new Set<string>([
  'https://thefibre.app',
  'https://meet.thefibre.app',
  'https://thread.thefibre.app',
  'https://flow.thefibre.app',
  'https://pulse.thefibre.app',
  'https://membership.thefibre.app',
  'https://sales.thefibre.app',
  'https://learn.thefibre.app',
]);
const DEV_ORIGINS = new Set<string>([
  'http://localhost:3000', // apps/web dev
  'http://localhost:3001', // apps/meet dev
  'http://localhost:3002', // apps/thread dev
  'http://localhost:3003', // apps/flow dev
  'http://localhost:3004', // apps/pulse dev
  'http://localhost:3005', // apps/membership dev
]);
const EXTRA_ORIGINS = new Set<string>(
  (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
);

// Match Vercel preview deploys like https://thefibre-web-git-feature-x-<hash>.vercel.app
// Sjoerd's preview branches need to call the API; the public domain is
// stable enough that we allowlist the entire *.vercel.app suffix only
// for the projects we know we own.
const VERCEL_PREVIEW_RE =
  /^https:\/\/(thefibre-web|thefibre-meet|thefibre-thread|thefibre-flow|thefibre-pulse|thefibre-membership)-[a-z0-9-]+\.vercel\.app$/;

function isAllowedOrigin(origin: string): boolean {
  if (PROD_ORIGINS.has(origin)) return true;
  if (DEV_ORIGINS.has(origin)) return true;
  if (EXTRA_ORIGINS.has(origin)) return true;
  if (VERCEL_PREVIEW_RE.test(origin)) return true;
  return false;
}

// ---------------------------------------------------------------------------
// The Thread's public read API — open to any website.
//
// These three GETs are a published contract (docs/brief-thread-public-api.md,
// documented at /developers). They were already unauthenticated — the auth
// bypass lives in PUBLIC_PREFIXES — so anyone with curl could read them. All
// this adds is the browser's permission to do the same, which is what a
// widget on a customer's site needs.
//
// `credentials: false` is load-bearing. An open origin WITH credentials is
// the combination browsers refuse, and wanting it would mean wanting
// somebody's session on someone else's page.
//
// SCOPED TO THREE EXACT PATHS, never the /public/ prefix. Sharing that prefix
// are POST /public/enrol and POST /public/validate-coupon, which the enrol
// form calls from the browser ('use client' → publicFetch). A prefix-wide
// cors() answers their preflight with "GET, OPTIONS" and enrolment stops
// working in production. One writes personal data and the other is a
// discount-code oracle; neither is going open regardless.
// ---------------------------------------------------------------------------
const PUBLISHED_READ_PATHS = [
  '/api/v1/thread/public/embed/threads',
  '/api/v1/thread/public/organiser/:slug',
  '/api/v1/thread/public/organiser/:slug/thread/:threadSlug',
];

/** Same three routes, matched against a concrete request path. */
const PUBLISHED_READ_RE = [
  /^\/api\/v1\/thread\/public\/embed\/threads$/,
  /^\/api\/v1\/thread\/public\/organiser\/[^/]+$/,
  /^\/api\/v1\/thread\/public\/organiser\/[^/]+\/thread\/[^/]+$/,
];

function isPublishedReadPath(path: string): boolean {
  return PUBLISHED_READ_RE.some((re) => re.test(path));
}

const publicReadCors = cors({
  origin: '*',
  allowHeaders: ['Content-Type'],
  allowMethods: ['GET', 'OPTIONS'],
  credentials: false,
  maxAge: 600,
});

// Rate limiting, applied only to the traffic this opening invites.
//
// Our own public pages render server-side from Vercel, so every visitor to
// thread.thefibre.app arrives at the API from a handful of Vercel egress IPs.
// A naive per-IP limit would throttle the whole site to a trickle while
// leaving a scraper on a home connection untouched — exactly backwards. So
// enforcement keys on what is actually new: a browser request from an origin
// that isn't ours. Server-to-server calls (no Origin) and our own apps pass
// through untouched.
const PUBLIC_READ_LIMIT = 60; // requests
const PUBLIC_READ_WINDOW_MS = 60_000; // per minute, per IP

for (const path of PUBLISHED_READ_PATHS) {
  app.use(path, publicReadCors);
  app.use(path, async (c, next) => {
    const origin = c.req.header('Origin');
    if (!origin || isAllowedOrigin(origin)) return next();

    const r = hit(
      `thread-public:${clientIp(c.req.raw.headers)}`,
      PUBLIC_READ_LIMIT,
      PUBLIC_READ_WINDOW_MS,
    );
    c.header('X-RateLimit-Limit', String(r.limit));
    c.header('X-RateLimit-Remaining', String(r.remaining));
    c.header('X-RateLimit-Reset', String(r.resetSeconds));
    if (!r.allowed) {
      c.header('Retry-After', String(r.resetSeconds));
      return c.json(
        { error: 'rate limit exceeded', detail: `max ${r.limit} requests per minute` },
        429,
      );
    }
    return next();
  });
}

// The workspace allowlist, for everything else. It must not run on the three
// published paths: its origin function returns '' for a stranger, which would
// undo the Access-Control-Allow-Origin: * that publicReadCors just set.
const allowlistCors = cors({
  // Hono's cors() treats a returned empty string as "don't add the
  // header" — i.e. blocked. Same-origin / server-to-server requests
  // (origin undefined) are unaffected.
  origin: (origin) => {
    if (!origin) return '';
    return isAllowedOrigin(origin) ? origin : '';
  },
  allowHeaders: ['Authorization', 'Content-Type', 'X-App-ID'],
  allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  credentials: true,
});

app.use('*', async (c, next) => {
  if (isPublishedReadPath(c.req.path)) return next();
  return allowlistCors(c, next);
});

app.get('/health', (c) => c.json({ ok: true, service: 'thefibre-api' }));

const v1 = new Hono().basePath('/api/v1');
v1.use('*', appContext);
v1.route('/auth', authRoutes);
v1.route('/persons', personsRoutes);
v1.route('/organisations', organisationsRoutes);
v1.route('/activities', activitiesRoutes);
v1.route('/programs', programsRoutes);
v1.route('/privacy', privacyRoutes);
v1.route('/sso', ssoRoutes);
v1.route('/signup-requests', signupRequestsRoutes);
v1.route('/workspace-apps', workspaceAppsRoutes);
v1.route('/workspaces', workspacesRoutes);
v1.route('/meet', meetRoutes);
v1.route('/flow', flowRoutes);
v1.route('/pulse', pulseRoutes);
v1.route('/membership', membershipRoutes);
v1.route('/teams', teamsRoutes);
v1.route('/thread', threadRoutes);
v1.route('/members', membersRoutes);
v1.route('/purchases', purchasesRoutes);
v1.route('/workspace-billing', workspaceBillingRoutes);
v1.route('/workspace-brand', workspaceBrandRoutes);
// The same handler under the name the screen actually has. /workspace-brand
// stays because The Thread's settings page is written against it.
v1.route('/workspace', workspaceBrandRoutes);
v1.route('/plan', planRoutes);
v1.route('/admin/plans', adminPlansRoutes);
v1.route('/public/plans', publicPlansRoutes);
v1.route('/billing', billingRoutes);
v1.route('/admin/economics', adminEconomicsRoutes);
v1.route('/admin/settings', adminSettingsRoutes);
v1.route('/admin/vat', adminVatRoutes);
v1.route('/uploads', uploadRoutes);
v1.route('/profile', profileRoutes);
v1.route('/apps', appsRoutes);
v1.route('/auth-hook', authHookRoutes);
app.route('/', v1);

const port = Number(process.env.API_PORT ?? 8080);
serve({ fetch: app.fetch, port }, ({ port }) => {
  console.log(`thefibre-api listening on :${port}`);
});

// Thread message scheduler — fixed + relative messages send when due.
// The Fly machine is pinned warm (min_machines_running=1), so an in-process
// interval is reliable; every send is dedup-logged, so restarts/overlaps
// are safe. First run shortly after boot, then every 5 minutes.
// DIY VAT: mirror the /admin/vat table into Stripe tax_rate objects at boot
// (idempotent — touches Stripe only on drift).
setTimeout(() => void ensureStripeTaxRates(), 15_000);

const SCHEDULER_INTERVAL_MS = 5 * 60 * 1000;
setTimeout(() => {
  void runThreadMessageScheduler().catch((e) =>
    console.error('[thread/scheduler] initial run failed', e),
  );
}, 20_000);
setInterval(() => {
  // Piggyback: hourly-ish guard, weekly probe of Stripe Tax → VAT table.
  void maybeSyncVatRates();
  void runThreadMessageScheduler().catch((e) =>
    console.error('[thread/scheduler] run failed', e),
  );
}, SCHEDULER_INTERVAL_MS);
