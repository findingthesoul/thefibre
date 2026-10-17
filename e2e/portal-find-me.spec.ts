// THE EYE: "can other members find you", over your own photo and name, at the
// top of my.thread → Memberships and Members (Sjoerd, 2026-10-17: "an EYE
// open or closed over your own photo and name ... clicking it opens a
// popup, where you click Being found by other members").
//
// On STAGING, as fixtures only (never a person), in the fixture workspace:
//   · the eye starts CLOSED (opt-in), the popup's switch opens it, and the
//     choice lands in the one store (membership_directory_entry.listed);
//     switching it off closes it again;
//   · PRIVACY: an unlisted member never appears in ANOTHER member's list.
//     Read as a second fixture account (e2e-member), with a positive
//     control: listed, the viewer IS in that list — so an empty list can
//     never be what passes the test.
// Everything seeded is removed and membership_settings restored by value.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { expect, test } from '@playwright/test';
import { HOSTS, fixtureIdentity, landSignedIn, stagingService } from './helpers.js';
import { E2E_MEMBER } from './identities.js';

const MY = process.env.MY_BASE ?? HOSTS.my;
const API = process.env.API_BASE ?? 'https://thefibre-api-staging.fly.dev';
const TAG = 'e2e-find-me';
let workspaceId = '';
let tierId = '';
let viewerPersonId = '';
let otherPersonId = '';
let createdOther = false;
let settingsBefore: Record<string, unknown> | null = null;
let hadSettings = false;

const env = Object.fromEntries(
  readFileSync(resolve(__dirname, '../apps/api/.env.staging'), 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim().replace(/^"|"$/g, '')]),
);

async function tokenFor(email: string): Promise<string> {
  const link = await stagingService().auth.admin.generateLink({ type: 'magiclink', email });
  if (link.error) throw link.error;
  const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
  const v = await anon.auth.verifyOtp({ type: 'magiclink', token_hash: link.data.properties.hashed_token });
  if (v.error || !v.data.session) throw v.error ?? new Error('no session');
  return v.data.session.access_token;
}

async function listAs(token: string): Promise<string[]> {
  const res = await fetch(`${API}/api/v1/membership/portal/me/directory/${workspaceId}/members`, { headers: { Authorization: `Bearer ${token}` } });
  expect(res.ok, `list read: ${res.status}`).toBe(true);
  const body = (await res.json()) as { items?: { person_id: string }[] };
  return (body.items ?? []).map((m) => m.person_id);
}

async function setListed(personId: string, listed: boolean) {
  const r = await stagingService()
    .from('membership_directory_entry')
    .upsert({ workspace_id: workspaceId, person_id: personId, listed, show_contact: false }, { onConflict: 'workspace_id,person_id' })
    .select('person_id');
  if (r.error) throw new Error(`entry: ${r.error.message}`);
}

test.beforeAll(async () => {
  const db = stagingService();
  const fixture = await fixtureIdentity();
  workspaceId = fixture.workspaceId;
  viewerPersonId = ((await db.from('person').select('id').eq('workspace_id', workspaceId).ilike('email', fixture.email).limit(1).single()).data!.id) as string;
  const other = await db.from('person').select('id').eq('workspace_id', workspaceId).ilike('email', E2E_MEMBER.email).is('deleted_at', null).limit(1).maybeSingle();
  if (other.data) otherPersonId = other.data.id as string;
  else {
    const made = await db.from('person').insert({ workspace_id: workspaceId, email: E2E_MEMBER.email, first_name: 'E2E', last_name: 'Other member' }).select('id').single();
    if (made.error) throw new Error(`seed other person: ${made.error.message}`);
    otherPersonId = made.data.id as string;
    createdOther = true;
  }
  tierId = (await db.from('membership_tier').insert({ workspace_id: workspaceId, name: `${TAG} tier`, hidden: true }).select('id').single()).data!.id as string;
  for (const personId of [viewerPersonId, otherPersonId]) {
    const m = await db.from('membership_member').upsert({ workspace_id: workspaceId, person_id: personId, tier_id: tierId, status: 'active', deleted_at: null }, { onConflict: 'workspace_id,person_id' }).select('id');
    if (m.error) throw new Error(`seed membership: ${m.error.message}`);
  }
  // The viewer starts as everybody does: no entry, i.e. not listed.
  await db.from('membership_directory_entry').delete().eq('workspace_id', workspaceId).eq('person_id', viewerPersonId);
  await setListed(otherPersonId, true);
  const existing = await db.from('membership_settings').select('*').eq('workspace_id', workspaceId).maybeSingle();
  hadSettings = Boolean(existing.data);
  settingsBefore = existing.data ?? null;
  const on = await db.from('membership_settings').upsert({ workspace_id: workspaceId, directory_enabled: true, directory_visibility: 'everybody' }, { onConflict: 'workspace_id' }).select('workspace_id');
  if (on.error) throw new Error(`seed settings: ${on.error.message}`);
});

test.afterAll(async () => {
  const db = stagingService();
  for (const personId of [viewerPersonId, otherPersonId].filter(Boolean)) {
    await db.from('membership_directory_entry').delete().eq('workspace_id', workspaceId).eq('person_id', personId);
    await db.from('membership_member').delete().eq('workspace_id', workspaceId).eq('person_id', personId);
  }
  if (createdOther && otherPersonId) await db.from('person').delete().eq('id', otherPersonId);
  if (tierId) await db.from('membership_tier').delete().eq('id', tierId);
  if (hadSettings && settingsBefore) await db.from('membership_settings').upsert(settingsBefore, { onConflict: 'workspace_id' });
  else if (!hadSettings) await db.from('membership_settings').delete().eq('workspace_id', workspaceId);
  const { count } = await db.from('membership_tier').select('id', { count: 'exact', head: true }).eq('id', tierId);
  expect(count ?? 0).toBe(0);
});

test('privacy: an unlisted member is never in another member\'s list (with a positive control)', async () => {
  const otherToken = await tokenFor(E2E_MEMBER.email);
  // Unlisted (the default): absent.
  expect(await listAs(otherToken)).not.toContain(viewerPersonId);
  // Listed: present — the control that proves the list is really being read.
  await setListed(viewerPersonId, true);
  expect(await listAs(otherToken)).toContain(viewerPersonId);
  // Unlisted again: absent again.
  await setListed(viewerPersonId, false);
  expect(await listAs(otherToken)).not.toContain(viewerPersonId);
});

for (const path of ['/memberships', '/members']) {
  test(`the eye on ${path}: closed by default, the popup opens it, and it lands in the store`, async ({ page }) => {
    test.slow();
    await stagingService().from('membership_directory_entry').delete().eq('workspace_id', workspaceId).eq('person_id', viewerPersonId);
    await landSignedIn(page, HOSTS.thread, 'the-thread', '/dashboard', /\/dashboard/);
    if (MY !== HOSTS.my) {
      const cookies = (await page.context().cookies()).filter((c) => c.name.startsWith('sb-'));
      await page.context().addCookies(cookies.map((c) => ({ name: c.name, value: c.value, domain: 'localhost', path: '/' })));
    }
    await page.goto(`${MY}${path}`, { timeout: 120_000 });
    const eye = page.getByRole('button', { name: /can’t find you|can't find you/ });
    await expect(eye).toBeVisible({ timeout: 60_000 });
    await expect(eye).toContainText('Hidden from other members');
    if (process.env.E2E_SHOTS) await page.screenshot({ path: `${process.env.E2E_SHOTS}/eye-closed${path.replace('/', '-')}.png` });
    await eye.click();
    const dialog = page.getByRole('dialog', { name: 'Being found by other members' });
    await expect(dialog.getByText('never public on the internet', { exact: false })).toBeVisible();
    const sw = dialog.getByRole('switch').first();
    await expect(sw).toHaveAttribute('aria-checked', 'false');
    if (process.env.E2E_SHOTS) await page.screenshot({ path: `${process.env.E2E_SHOTS}/eye-popup${path.replace('/', '-')}.png` });
    await sw.click();
    await expect(sw).toHaveAttribute('aria-checked', 'true');
    await expect
      .poll(async () => (await stagingService().from('membership_directory_entry').select('listed').eq('workspace_id', workspaceId).eq('person_id', viewerPersonId).maybeSingle()).data?.listed, { timeout: 15_000 })
      .toBe(true);
    await dialog.getByRole('button', { name: 'Close' }).last().click();
    await expect(page.getByRole('button', { name: /can find you/ })).toContainText('Visible to other members');
    // The page agrees with the eye: no "not shown" notice once you are listed.
    await expect(page.getByText(/not shown to other members/)).toHaveCount(0, { timeout: 15_000 });
    if (process.env.E2E_SHOTS) await page.screenshot({ path: `${process.env.E2E_SHOTS}/eye-open${path.replace('/', '-')}.png` });
    // And off again, the same way.
    await page.getByRole('button', { name: /can find you/ }).click();
    await dialog.getByRole('switch').first().click();
    await expect
      .poll(async () => (await stagingService().from('membership_directory_entry').select('listed').eq('workspace_id', workspaceId).eq('person_id', viewerPersonId).maybeSingle()).data?.listed, { timeout: 15_000 })
      .toBe(false);
  });
}
