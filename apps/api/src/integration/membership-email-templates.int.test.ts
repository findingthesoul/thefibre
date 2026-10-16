// Member emails, editable per community (Sjoerd 2ix): the admin routes and
// the send-time choice, against staging. An admin fixture writes through its
// own RLS client; a non-admin member is refused; the database's own rules are
// asserted by error code; the preview is the SAME template the sends use.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Hono } from 'hono';
import { createClient } from '@supabase/supabase-js';
import { createFixtureUser, createThrowawayWorkspace, deleteFixtureUser, deleteThrowawayWorkspace, service, type FixtureUser } from './staging.js';

let app: Hono;
let ws = '';
let admin: FixtureUser;
let member: FixtureUser;
let tierId = '';
let foreignTierId = '';
const uploaded: string[] = [];

const call = (who: FixtureUser, method: string, path: string, body?: unknown, raw?: BodyInit) =>
  app.request(`/api/v1/membership${path}`, {
    method,
    headers: { Authorization: `Bearer ${who.accessToken}`, 'X-App-ID': 'membership', ...(raw ? {} : { 'Content-Type': 'application/json' }) },
    body: raw ?? (body === undefined ? undefined : JSON.stringify(body)),
  });
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0, 0x1f, 0x15, 0xc4, 0x89]);
const upload = (bytes: Uint8Array, name = 'x.png') => {
  const fd = new FormData();
  fd.append('file', new File([bytes], name));
  return call(admin, 'POST', '/email-templates/image', undefined, fd);
};

beforeAll(async () => {
  const { appContext } = await import('../middleware/app-context.js');
  const { membershipRoutes } = await import('../routes/membership.js');
  app = new Hono();
  const v1 = new Hono();
  v1.use('*', appContext);
  v1.route('/membership', membershipRoutes);
  app.route('/api/v1', v1);

  const appId = (await service.from('app').select('id').eq('slug', 'membership').single()).data!.id as string;
  ws = await createThrowawayWorkspace('emailtpl');
  await service.from('workspace_app').upsert({ workspace_id: ws, app_id: appId }, { onConflict: 'workspace_id,app_id' });
  await service.from('workspace').update({ name: 'Template Community' }).eq('id', ws);
  admin = await createFixtureUser(ws, 'emailtpl-admin');
  member = await createFixtureUser(ws, 'emailtpl-member');
  await service.from('workspace_member').upsert({ workspace_id: ws, user_id: admin.userId, workspace_role: 'admin' });
  await service.from('app_membership').upsert({ user_id: admin.userId, app_id: appId, role: 'admin' }, { onConflict: 'user_id,app_id' });
  await service.from('app_membership').upsert({ user_id: member.userId, app_id: appId, role: 'member' }, { onConflict: 'user_id,app_id' });
  tierId = (await service.from('membership_tier').insert({ workspace_id: ws, name: 'Singer', price_cents_year: 30000, hidden: false, description: 'Our own description.' }).select('id').single()).data!.id as string;
  // Another community's tier, to refuse.
  const { data: other } = await service.from('membership_tier').select('id').neq('workspace_id', ws).limit(1).single();
  foreignTierId = other!.id as string;
}, 120_000);

afterAll(async () => {
  if (uploaded.length) await service.storage.from('fibre-assets').remove(uploaded);
  await service.from('membership_email_template').delete().eq('workspace_id', ws);
  await service.from('membership_tier').delete().eq('workspace_id', ws);
  await service.from('app_membership').delete().in('user_id', [admin?.userId, member?.userId].filter(Boolean) as string[]);
  await service.from('workspace_member').delete().eq('workspace_id', ws);
  await service.from('workspace_app').delete().eq('workspace_id', ws);
  if (admin) await deleteFixtureUser(admin);
  if (member) await deleteFixtureUser(member);
  if (ws) await deleteThrowawayWorkspace(ws);
}, 120_000);

describe('member emails, edited by the community', () => {
  it('an admin saves a welcome per tier and a default, and reads them back', async () => {
    const a = await call(admin, 'PUT', '/email-templates', { kind: 'welcome', tier_id: tierId, locale: 'nl', subject: 'Welkom {first_name}', intro_html: '<p>Hoi {first_name}!</p><script>x</script>' });
    expect(a.status, await a.clone().text()).toBe(200);
    const b = await call(admin, 'PUT', '/email-templates', { kind: 'welcome', tier_id: null, locale: 'en', subject: 'Welcome to {community}', closing: 'See you soon' });
    expect(b.status).toBe(200);
    // Saving the same key again UPDATES, never duplicates.
    const again = await call(admin, 'PUT', '/email-templates', { kind: 'welcome', tier_id: null, locale: 'en', subject: 'Welcome, {first_name}' });
    expect((await again.json()).id).toBe((await b.json()).id);
    const list = (await (await call(admin, 'GET', '/email-templates')).json()).items as { tier_id: string | null; intro_html: string | null; subject: string }[];
    expect(list).toHaveLength(2);
    expect(list.find((r) => r.tier_id === tierId)!.intro_html, 'sanitised').not.toContain('<script');
    expect(list.find((r) => r.tier_id === null)!.subject).toBe('Welcome, {first_name}');
  });

  it('another community’s tier is refused', async () => {
    const r = await call(admin, 'PUT', '/email-templates', { kind: 'welcome', tier_id: foreignTierId, locale: 'en', subject: 'x' });
    expect(r.status).toBe(400);
  });

  it('a member who is not an admin can neither save nor read', async () => {
    const r = await call(member, 'PUT', '/email-templates', { kind: 'digest', locale: 'en', subject: 'nope' });
    expect(r.status).not.toBe(200);
    expect((await (await call(member, 'GET', '/email-templates')).json()).items ?? []).toHaveLength(0);
    expect((await call(member, 'POST', '/email-templates/preview', { kind: 'digest', locale: 'en' })).status).toBe(403);
  });

  it('the database’s own rules, by error code', async () => {
    const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY!);
    expect((await anon.from('membership_email_template').insert({ workspace_id: ws, kind: 'digest', locale: 'de' })).error?.code).toBe('42501');
    expect((await admin.client.from('membership_email_template').insert({ workspace_id: ws, kind: 'welcome', locale: 'en' })).error?.code).toBe('23505');
    expect((await service.from('membership_email_template').insert({ workspace_id: ws, kind: 'digest', tier_id: tierId, locale: 'fr' })).error?.code).toBe('23514');
    expect((await service.from('membership_email_template').insert({ workspace_id: ws, kind: 'digest', locale: 'es', image_path: 'x.png' })).error?.code).toBe('23514');
  });

  it('an image: a real PNG is stored publicly; other bytes and big files are refused; an image needs alt text', async () => {
    const ok = await upload(PNG);
    expect(ok.status, await ok.clone().text()).toBe(201);
    const { path, url } = await ok.json();
    uploaded.push(path);
    expect(path.startsWith(`membership-email/${ws}/`)).toBe(true);
    expect((await fetch(url)).status).toBe(200);
    expect((await upload(new TextEncoder().encode('<svg onload=alert(1)>'), 'x.png')).status).toBe(400);
    expect((await upload(new Uint8Array(2 * 1024 * 1024 + 10).fill(1).map((v, i) => (i < PNG.length ? PNG[i]! : v)))).status).toBe(400);
    expect((await call(admin, 'PUT', '/email-templates', { kind: 'digest', locale: 'en', image_path: path })).status).toBe(400);
    expect((await call(admin, 'PUT', '/email-templates', { kind: 'digest', locale: 'en', image_path: `membership-email/${randomUUID()}/x.png`, image_alt: 'x' })).status, 'another workspace’s path').toBe(400);
    expect((await call(admin, 'PUT', '/email-templates', { kind: 'digest', locale: 'en', image_path: path, image_alt: 'Our choir' })).status).toBe(200);
  });

  it('the preview is the real template: the community’s words, the FACTS still there', async () => {
    const r = await call(admin, 'POST', '/email-templates/preview', { kind: 'welcome', tier_id: tierId, locale: 'en', subject: 'Hello {first_name} from {community}', intro_html: '<p>Renews on {renews_on}.</p>', closing: 'Warmly, the choir' });
    expect(r.status, await r.clone().text()).toBe(200);
    const p = await r.json();
    expect(p.subject).toBe('Hello Marja from Template Community');
    expect(p.html).toContain('Renews on 1 January');
    expect(p.html).toContain('Warmly, the choir');
    // Ours, always: the portal button and the sign-in sentence.
    expect(p.html).toContain('/memberships');
    expect(p.html).not.toContain('Our own description.'); // replaced by their intro
  });

  it('at send time: the tier’s row in the member’s language, else the page language, else the default', async () => {
    const { communityWords } = await import('../lib/member-email-templates.js');
    const nl = await communityWords({ workspaceId: ws, kind: 'welcome', tierId, memberLocale: 'nl', values: { first_name: 'Marja' } });
    expect(nl?.subject).toBe('Welkom Marja');
    const enDefault = await communityWords({ workspaceId: ws, kind: 'welcome', tierId: null, memberLocale: 'en', values: { first_name: 'Marja' } });
    expect(enDefault?.subject).toBe('Welcome, Marja');
    const none = await communityWords({ workspaceId: ws, kind: 'digest', memberLocale: 'fr', values: {} });
    // The digest row exists in EN; the page language defaults to EN → it is used.
    expect(none?.imageAlt).toBe('Our choir');
  });

  it('the digest preview renders too (the sessions list stays ours)', async () => {
    const r = await call(admin, 'POST', '/email-templates/preview', { kind: 'digest', locale: 'en', intro_html: '<p>New this month, {first_name}:</p>' });
    expect(r.status, await r.clone().text()).toBe(200);
    const p = await r.json();
    expect(p.html).toContain('New this month, Marja:');
    expect(p.html).toContain('Open rehearsal');
  });

  it('send me a test: to the admin’s own address only', async () => {
    const r = await call(admin, 'POST', '/email-templates/send-test', { kind: 'digest', locale: 'en', subject: 'Digest test' });
    expect(r.status, await r.clone().text()).toBe(200);
    expect((await r.json()).sent_to).toBe(admin.email);
  });

  it('reset to the standard text removes the row', async () => {
    const list = (await (await call(admin, 'GET', '/email-templates')).json()).items as { id: string; kind: string }[];
    const digest = list.find((x) => x.kind === 'digest')!;
    expect((await call(admin, 'DELETE', `/email-templates/${digest.id}`)).status).toBe(204);
    const { count } = await service.from('membership_email_template').select('id', { count: 'exact', head: true }).eq('id', digest.id);
    expect(count).toBe(0);
  });

  // ── The SIGNATURE (2ix): one sign-off for the five transactional emails.
  it('a signature saves as a sign-off only: bold, italic, links kept; the rest stripped; no subject or image', async () => {
    const r = await call(admin, 'PUT', '/email-templates', {
      kind: 'signature',
      locale: 'en',
      subject: 'ignored',
      closing: 'ignored',
      intro_html: '<h1>Big</h1><p>Warmly, <strong>{community}</strong> · <a href="https://choir.example">site</a></p><img src="x"><script>x</script>',
    });
    expect(r.status, await r.clone().text()).toBe(200);
    const { data: row } = await service.from('membership_email_template').select('subject, closing, image_path, intro_html').eq('workspace_id', ws).eq('kind', 'signature').eq('locale', 'en').single();
    expect(row!.subject).toBeNull();
    expect(row!.closing).toBeNull();
    expect(row!.intro_html).not.toMatch(/<h1|<img|<script/);
    expect(row!.intro_html).toContain('<strong>{community}</strong>');
    expect(row!.intro_html).toContain('href="https://choir.example"');
  });

  it('the signature preview is a renewal reminder, signed, the facts still ours', async () => {
    const r = await call(admin, 'POST', '/email-templates/preview', { kind: 'signature', locale: 'en', intro_html: '<p>Warmly, <em>{community}</em></p>' });
    expect(r.status, await r.clone().text()).toBe(200);
    const p = await r.json();
    expect(p.html).toContain('Warmly, <em>Template Community</em>');
    // The reminder's own facts, before the sign-off.
    expect(p.html.indexOf('Template Community')).toBeLessThan(p.html.indexOf('Warmly'));
  });

  it('at send time: the member’s language, else the page language, else none', async () => {
    const { communitySignature } = await import('../lib/member-email-templates.js');
    const en = await communitySignature({ workspaceId: ws, memberLocale: 'en', values: { community: 'Template Community' } });
    expect(en).toContain('<strong>Template Community</strong>');
    // French: no row; the page language (EN by default) is used.
    expect(await communitySignature({ workspaceId: ws, memberLocale: 'fr', values: { community: 'X' } })).toContain('<strong>X</strong>');
    // A community with no signature: none.
    const { data: other } = await service.from('workspace').select('id').neq('id', ws).limit(1).single();
    const { count } = await service.from('membership_email_template').select('id', { count: 'exact', head: true }).eq('workspace_id', other!.id).eq('kind', 'signature');
    if (!count) expect(await communitySignature({ workspaceId: other!.id as string, memberLocale: 'en', values: {} })).toBeNull();
  });

  it('send me a test, for the signature: to the admin’s own address', async () => {
    const r = await call(admin, 'POST', '/email-templates/send-test', { kind: 'signature', locale: 'en', intro_html: '<p>Warmly</p>' });
    expect(r.status, await r.clone().text()).toBe(200);
    expect((await r.json()).sent_to).toBe(admin.email);
  });
});
