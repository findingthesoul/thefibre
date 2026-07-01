import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';
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
import { meetRoutes } from './routes/meet.js';
import { flowRoutes } from './routes/flow.js';
import { threadRoutes } from './routes/thread.js';
import { appsRoutes } from './routes/apps.js';
import { authHookRoutes } from './routes/auth-hook.js';

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
  'https://sales.thefibre.app',
  'https://learn.thefibre.app',
]);
const DEV_ORIGINS = new Set<string>([
  'http://localhost:3000', // apps/web dev
  'http://localhost:3001', // apps/meet dev
  'http://localhost:3002', // apps/thread dev
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
  /^https:\/\/(thefibre-web|thefibre-meet|thefibre-thread)-[a-z0-9-]+\.vercel\.app$/;

function isAllowedOrigin(origin: string): boolean {
  if (PROD_ORIGINS.has(origin)) return true;
  if (DEV_ORIGINS.has(origin)) return true;
  if (EXTRA_ORIGINS.has(origin)) return true;
  if (VERCEL_PREVIEW_RE.test(origin)) return true;
  return false;
}

app.use(
  '*',
  cors({
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
  }),
);

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
v1.route('/meet', meetRoutes);
v1.route('/flow', flowRoutes);
v1.route('/thread', threadRoutes);
v1.route('/apps', appsRoutes);
v1.route('/auth-hook', authHookRoutes);
app.route('/', v1);

const port = Number(process.env.API_PORT ?? 8080);
serve({ fetch: app.fetch, port }, ({ port }) => {
  console.log(`thefibre-api listening on :${port}`);
});
