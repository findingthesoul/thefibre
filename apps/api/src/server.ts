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

const app = new Hono();

app.use('*', logger());
app.use(
  '*',
  cors({
    origin: (origin) => origin ?? '*',
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
app.route('/', v1);

const port = Number(process.env.API_PORT ?? 8080);
serve({ fetch: app.fetch, port }, ({ port }) => {
  console.log(`thefibre-api listening on :${port}`);
});
