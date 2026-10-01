import { Hono, type Context } from 'hono';
import { serve } from '@hono/node-server';
import { logger } from 'hono/logger';
import { secureHeaders } from 'hono/secure-headers';
import { cors } from 'hono/cors';
import { hit, clientIp } from './lib/rate-limit.js';
import { CORS_ALLOW_METHODS, isAllowedOrigin } from './lib/cors-origins.js';
import { appContext } from './middleware/app-context.js';
import { authRoutes } from './routes/auth.js';
import { personsRoutes } from './routes/persons.js';
import { connectionsRoutes } from './routes/connections.js';
import { notesRoutes } from './routes/notes.js';
import { connectionsTodayRoutes } from './routes/connections-today.js';
import { connectionsEntriesRoutes } from './routes/connections-entries.js';
import { connectionsLabelsRoutes } from './routes/connections-labels.js';
import { connectionsTagsRoutes } from './routes/connections-tags.js';
import { connectionsTeamsRoutes } from './routes/connections-teams.js';
import { connectionsAgendaRoutes } from './routes/connections-agenda.js';
import { connectionsCalendarsRoutes } from './routes/connections-calendars.js';
import { connectionsHygieneRoutes } from './routes/connections-hygiene.js';
import { connectionsMapRoutes } from './routes/connections-map.js';
import { connectionsEffortRoutes } from './routes/connections-effort.js';
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
import { membershipRoutes, runMembershipScheduler } from './routes/membership.js';
import { withSchedulerLease } from './lib/scheduler-lease.js';
import { runBillingMeterTick } from './routes/billing.js';
import { runHygieneSweep } from './lib/hygiene.js';
import { currenciesRoutes } from './routes/currencies.js';
import { membershipPortalRoutes } from './routes/membership-portal.js';
import { portalRoutes } from './routes/portal.js';
import { myTasksRoutes, fileFinishedTasks } from './routes/my-tasks.js';
import { oauthProviderRoutes } from './routes/oauth-provider.js';
import { teamsRoutes } from './routes/teams.js';
import { threadRoutes, runThreadMessageScheduler } from './routes/thread.js';
import { threadTaskRoutes } from './routes/thread-tasks.js';
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
import { adminFeeStatementsRoutes } from './routes/admin-fee-statements.js';
import { runFeeStatementTick } from './lib/fee-statements.js';
import { uploadRoutes } from './routes/uploads.js';
import { profileRoutes } from './routes/profile.js';
import { appsRoutes } from './routes/apps.js';
import { authHookRoutes } from './routes/auth-hook.js';
import { isMcpHost, mcpDiscoveryRoutes } from './routes/mcp-discovery.js';
import { mcpAuthRoutes } from './routes/mcp-auth.js';
import { mcpRootRoutes, mcpRoutes } from './routes/mcp.js';
import { assistantRoutes } from './routes/assistant.js';
import { modelsRoutes } from './routes/models.js';
import { maybeSyncVatRates } from './lib/vat-sync.js';
import { ensureStripeTaxRates } from './lib/vat-stripe.js';

const app = new Hono();

app.use('*', logger());
// Baseline response headers (docs/data-protection-approach.md). The API
// serves JSON to scripts and to our own apps; it is never framed and never
// sniffed. Cross-origin isolation headers are left off: they change how
// browsers treat cross-origin fetches and the embeds fetch from here.
app.use(
  '*',
  secureHeaders({
    strictTransportSecurity: 'max-age=31536000; includeSubDomains',
    xFrameOptions: 'DENY',
    referrerPolicy: 'strict-origin-when-cross-origin',
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: false,
    originAgentCluster: false,
  }),
);

// CORS allowlist: which origins and which methods — lib/cors-origins.ts,
// where it can be tested (this file starts a listener on import).

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
// app.thethread.app arrives at the API from a handful of Vercel egress IPs.
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

// A brake on the public POSTs: enrolments, bookings, sign-up requests,
// coupon checks, portal codes, OAuth token exchange, app registration. These
// are the routes a script can hit with no credential at all, and a coupon or
// a portal code is guessable in principle. The browser-side ones (the enrol
// form, the booking page) arrive with the visitor's own IP; the server-side
// ones (sign-up requests through a Next action) arrive from Vercel's egress,
// which is why the limit is generous: it stops a naive loop, not a rush of
// real people, and it keys on path family so one busy form cannot starve
// another. An in-memory, per-machine window, like the read limiter above —
// an abuse brake, not a security control.
const PUBLIC_POST_LIMIT = 120; // requests
const PUBLIC_POST_WINDOW_MS = 60_000; // per minute, per IP, per family
const PUBLIC_POST_FAMILIES = [
  '/api/v1/thread/public/',
  '/api/v1/meet/public/',
  '/api/v1/membership/public/',
  '/api/v1/membership/portal/',
  '/api/v1/oauth/',
  '/api/v1/me/',
  '/api/v1/signup-requests',
  '/api/v1/apps/register',
];

app.use('/api/v1/*', async (c, next) => {
  if (c.req.method !== 'POST') return next();
  const family = PUBLIC_POST_FAMILIES.find((f) => c.req.path.startsWith(f));
  if (!family) return next();
  const r = hit(
    `public-post:${family}:${clientIp(c.req.raw.headers)}`,
    PUBLIC_POST_LIMIT,
    PUBLIC_POST_WINDOW_MS,
  );
  if (!r.allowed) {
    c.header('Retry-After', String(r.resetSeconds));
    return c.json(
      { error: 'rate limit exceeded', detail: `max ${r.limit} requests per minute` },
      429,
    );
  }
  return next();
});

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
  allowMethods: CORS_ALLOW_METHODS,
  credentials: true,
});

// The OAuth surface an MCP client talks to from wherever it runs — a
// desktop app, Anthropic's or OpenAI's servers, a browser-based inspector.
// Discovery documents are public by definition; register/token/revoke are
// protected by PKCE and the per-IP brakes, not by origin. So these answer
// any origin, and the workspace allowlist below skips them.
const OPEN_OAUTH_PATHS = new Set(['/api/v1/oauth/register', '/api/v1/oauth/token', '/api/v1/oauth/revoke', '/api/v1/mcp']);
const openCors = cors({ origin: '*', allowHeaders: ['Authorization', 'Content-Type', 'Mcp-Session-Id', 'Mcp-Protocol-Version'], allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'], exposeHeaders: ['Mcp-Session-Id', 'WWW-Authenticate'] });
app.use('/.well-known/*', openCors);
for (const p of OPEN_OAUTH_PATHS) app.use(p, openCors);

// On an mcp.* host the root IS the MCP endpoint (routes/mcp.ts mcpRootRoutes),
// so it gets the same open CORS as /api/v1/mcp.
const mcpRoot = (c: Context) => c.req.path === '/' && isMcpHost(c.req.raw.headers);
app.use('/', async (c, next) => (mcpRoot(c) ? openCors(c, next) : next()));

app.use('*', async (c, next) => {
  if (isPublishedReadPath(c.req.path) || c.req.path.startsWith('/.well-known/') || OPEN_OAUTH_PATHS.has(c.req.path) || mcpRoot(c)) return next();
  return allowlistCors(c, next);
});

// OAuth discovery for MCP clients (routes/mcp-discovery.ts) — at the origin
// root, where RFC 8414 / 9728 say they live; outside /api/v1 so no auth runs.
app.route('/', mcpDiscoveryRoutes);
// https://mcp.thefibre.app — the connector address is the hostname alone.
app.route('/', mcpRootRoutes);

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
v1.route('/connections', connectionsRoutes);
v1.route('/notes', notesRoutes);
v1.route('/connections', connectionsTodayRoutes);
v1.route('/connections', connectionsEntriesRoutes);
v1.route('/connections', connectionsLabelsRoutes);
v1.route('/connections', connectionsTagsRoutes);
v1.route('/connections', connectionsTeamsRoutes);
v1.route('/connections', connectionsAgendaRoutes);
v1.route('/connections', connectionsCalendarsRoutes);
v1.route('/connections', connectionsHygieneRoutes);
v1.route('/connections', connectionsMapRoutes);
v1.route('/connections', connectionsEffortRoutes);
v1.route('/membership', membershipRoutes);
v1.route('/currencies', currenciesRoutes);
v1.route('/membership/portal', membershipPortalRoutes);
// The in-app assistant (docs/assistant-in-app.md). User sessions only; the
// app-key allow-list in middleware/app-context.ts keeps keys out of it.
v1.route('/assistant', assistantRoutes);
v1.route('/models', modelsRoutes);
// A person's own assistant, acting as them (docs/mcp-personal-access-plan.md):
// consent + grants under the user session; the MCP endpoint carries its own
// bearer (a public path in middleware/app-context.ts, verified in the handler).
v1.route('/mcp-auth', mcpAuthRoutes);
v1.route('/mcp', mcpRoutes);
// The visitor's own place, across every app (docs/visitor-portal-proposal.md).
v1.route('/me', portalRoutes);
// NOT under /me: that prefix is the visitor portal, where a participant JWT is
// verified inside the handler and no workspace context exists. A staff route
// mounted there gets no ctx at all (500s on staging, 2026-09-23).
v1.route('/tasks', myTasksRoutes);
v1.route('/oauth', oauthProviderRoutes);
v1.route('/teams', teamsRoutes);
v1.route('/thread', threadRoutes);
// A thread's own to-do list and the to-do templates, on the same prefix.
// Its own file because routes/thread.ts is ~6000 lines and several
// sessions edit it at once; the paths read as if they lived there.
v1.route('/thread', threadTaskRoutes);
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
v1.route('/admin/fee-statements', adminFeeStatementsRoutes);
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

// Every tick runs under a LEASE (lib/scheduler-lease.ts, 2026-09-26): the Fly
// config deploys blue-green, so for a moment two processes are up and both
// would fire these — the usage meter's guard is module memory and the access
// syncs have no lock. One holder per job name at a time; a dead holder
// releases by TTL. This is also the prerequisite for a second machine.
const SCHEDULER_INTERVAL_MS = 5 * 60 * 1000;
const LEASE_TTL_MS = 4 * 60 * 1000; // under the 5-min tick: a wedged run frees itself before the next
function leased(name: string, run: () => Promise<unknown>, label: string) {
  void withSchedulerLease(name, LEASE_TTL_MS, async () => {
    await run();
  }).catch((e) => console.error(`[${label}] run failed`, e));
}
function runAllSchedulers() {
  leased('thread-messages', runThreadMessageScheduler, 'thread/scheduler');
  // Membership renewal reminders + manual-member grace/lapse sweep + the
  // Circle / Fibre-seat / Google / Thread access syncs.
  leased('membership', runMembershipScheduler, 'membership/scheduler');
  // Usage meters: 80% warnings, overage invoice items, Free archive sweep
  // (hourly guard lives inside the lib — and is module memory, hence the lease).
  leased('billing-meters', runBillingMeterTick, 'billing/meters');
  // Nightly hygiene sweep (connections-data-integrity.md §9.3); its own
  // nightly guard is persisted in hygiene_run.
  leased('hygiene', runHygieneSweep, 'hygiene');
  // Monthly platform-fee statements: the previous month, from the 2nd on;
  // idempotent on the ledger (lib/fee-statements.ts).
  leased('fee-statements', () => runFeeStatementTick(), 'fee-statements');
  // To-do archive: ticked items sit there seven days, then get FILED out of
  // the view — never deleted (Sjoerd, 2026-09-23: "archive - not delete").
  // Idempotent and a single UPDATE.
  leased('file-finished-tasks', fileFinishedTasks, 'me/tasks');
  // Weekly probe of Stripe Tax → the VAT table (its own guard reads the last
  // run from platform settings). Under the lease since 2026-10-01: it was the
  // one tick still fired bare, and its guard is read-then-write, so two
  // processes in a blue-green window could both pass it, both probe Stripe
  // and both mail the operator the same change.
  leased('vat-sync', maybeSyncVatRates, 'vat-sync');
}
setTimeout(runAllSchedulers, 20_000);
setInterval(runAllSchedulers, SCHEDULER_INTERVAL_MS);
