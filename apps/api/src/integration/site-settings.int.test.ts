// Settings → Website, saved through the real route and read back from the
// public page — the path that was never tested, and was broken.
//
// 2026-09-14. Sjoerd chose the Festival design and uploaded a logo, and his
// public page stayed plain: "The website stuff does not show up in the front
// end." The site fields had been added to the WRONG Zod schema (PATCH /me
// instead of PATCH /settings), so the save answered 200 and Zod stripped every
// field. It had been that way since the feature shipped on 2026-09-11.
//
// It survived because the only check at the time wrote the design straight
// into the database and then looked at the public page. That proved the
// renderer and skipped the save — the one step a real user takes. This test
// takes that step: the exact payload Settings → Website sends, through the
// real middleware and route, then the public payload a visitor's page reads.
//
// Staging only, throwaway workspace, cleaned by its own ids.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Hono } from 'hono';
import {
  createFixtureUser,
  createThrowawayWorkspace,
  deleteFixtureUser,
  deleteThrowawayWorkspace,
  service,
  type FixtureUser,
} from './staging.js';

let app: Hono;
let ws: string;
let wsSlug: string;
let admin: FixtureUser;
let thethreadAppId: string;

async function call(method: string, path: string, body?: unknown): Promise<Response> {
  return app.request(`/api/v1/thread${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${admin.accessToken}`,
      'X-App-ID': 'the-thread',
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

/** Exactly what apps/thread/app/(app)/settings/website/form.tsx sends. */
const FORM_PAYLOAD = {
  site_theme: 'festival',
  site_name: 'Festival of Trust',
  site_logo_url: 'https://example.com/logo.png',
  site_hero_url: 'https://example.com/hero.jpg',
  site_headline: 'Three days of trust',
  site_intro: '<p>A gathering.</p><script>alert(1)</script>',
  site_footer_note: 'Zierikzee',
  site_links: [{ label: 'About', href: 'https://example.com/about' }],
  site_contact_enabled: true,
  site_contact_email: 'hello@example.com',
  site_contact_intro: 'Write to us.',
};

beforeAll(async () => {
  const { appContext } = await import('../middleware/app-context.js');
  const { threadRoutes } = await import('../routes/thread.js');
  app = new Hono();
  const v1 = new Hono();
  v1.use('*', appContext);
  v1.route('/thread', threadRoutes);
  app.route('/api/v1', v1);

  const { data: appRow } = await service.from('app').select('id').eq('slug', 'the-thread').single();
  thethreadAppId = appRow!.id as string;
  ws = await createThrowawayWorkspace('site');
  const { data: w } = await service.from('workspace').select('slug').eq('id', ws).single();
  wsSlug = w!.slug as string;
  admin = await createFixtureUser(ws, 'site-admin');
  await service.from('workspace_member').upsert({ workspace_id: ws, user_id: admin.userId, workspace_role: 'admin' });
  await service
    .from('app_membership')
    .upsert({ user_id: admin.userId, app_id: thethreadAppId, role: 'admin' }, { onConflict: 'user_id,app_id' });
  await call('GET', '/settings'); // provisions the thread_settings row, as the page does
}, 60_000);

afterAll(async () => {
  if (ws) await service.from('thread_settings').delete().eq('workspace_id', ws);
  if (admin) {
    await service.from('app_membership').delete().eq('user_id', admin.userId);
    await service.from('workspace_member').delete().eq('user_id', admin.userId);
    await deleteFixtureUser(admin);
  }
  if (ws) await deleteThrowawayWorkspace(ws);
}, 60_000);

describe('saving Settings → Website', () => {
  it('stores every field the form sends', async () => {
    const res = await call('PATCH', '/settings', FORM_PAYLOAD);
    expect(res.status).toBe(200);
    const { data } = await service
      .from('thread_settings')
      .select(
        'site_theme, site_name, site_logo_url, site_hero_url, site_headline, site_intro, site_footer_note, site_links, site_contact_enabled, site_contact_email, site_contact_intro',
      )
      .eq('workspace_id', ws)
      .single();
    expect(data).toMatchObject({
      site_theme: 'festival',
      site_name: 'Festival of Trust',
      site_logo_url: 'https://example.com/logo.png',
      site_hero_url: 'https://example.com/hero.jpg',
      site_headline: 'Three days of trust',
      site_footer_note: 'Zierikzee',
      site_links: [{ label: 'About', href: 'https://example.com/about' }],
      site_contact_enabled: true,
      site_contact_email: 'hello@example.com',
      site_contact_intro: 'Write to us.',
    });
    // The intro is sanitised on the way in: the paragraph survives, the script does not.
    expect(data!.site_intro).toContain('<p>A gathering.</p>');
    expect(data!.site_intro).not.toContain('script');
  });

  it('shows the saved design to a visitor', async () => {
    // No Authorization: this is what a stranger's browser reads.
    const res = await app.request(`/api/v1/thread/public/organiser/${wsSlug}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { site?: Record<string, unknown> };
    expect(body.site).toMatchObject({
      theme: 'festival',
      name: 'Festival of Trust',
      logo_url: 'https://example.com/logo.png',
      contact_enabled: true,
    });
    // The delivery address is where the form's mail goes, and never public.
    expect(JSON.stringify(body.site)).not.toContain('hello@example.com');
  });

  it('can be put back to plain', async () => {
    // The twin of the save above: changing the design again must also land,
    // so the first test cannot pass on a value left over from somewhere else.
    const res = await call('PATCH', '/settings', { ...FORM_PAYLOAD, site_theme: 'plain' });
    expect(res.status).toBe(200);
    const { data } = await service.from('thread_settings').select('site_theme').eq('workspace_id', ws).single();
    expect(data!.site_theme).toBe('plain');
  });
});
