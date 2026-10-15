// How long the portal's member list takes to arrive, on a deployed stack.
//
// Builder 3 measured my.thefibre.tech → Members at about 4.3s on 2026-10-15.
// Three causes, each fixed in the same release as this spec: the page waited
// for the whole /me/portal payload just to learn the token; /members
// redirected to /members/<ws>, so a one-community member paid for every
// render twice; and the API asked its questions about the list one after
// another. This times both doors, five times each, and prints the medians so
// the number is something a person can read rather than a feeling.
//
// THE CEILING IS LOOSE ON PURPOSE. The target is about a second; the assert
// is three. Staging is a shared machine and a cold Vercel function adds its
// own second, so a tight bound would be a flake, and a flake teaches people
// to ignore the spec. What it does catch is the shape coming back — a second
// round trip, a serial chain — which costs whole seconds, not tenths.
//
// Seeds its own two members and removes them, like portal-members-list.

import { expect, test } from '@playwright/test';
import { HOSTS, fixtureIdentity, fixtureThread, landSignedIn, stagingService } from './helpers.js';

const TAG = 'e2e-portal-members-speed';
let workspaceId = '';
let tierId = '';
let personIds: string[] = [];
let settingsBefore: Record<string, unknown> | null = null;
let hadSettings = false;

test.beforeAll(async () => {
  const service = stagingService();
  const identity = await fixtureIdentity();
  const t = await fixtureThread();
  workspaceId = identity.workspaceId;

  const people = await service
    .from('person')
    .select('id, email')
    .eq('workspace_id', workspaceId)
    .in('email', [identity.email, t.personEmail]);
  if (people.error) throw new Error(`seed people: ${people.error.message}`);
  personIds = (people.data ?? []).map((p) => p.id as string);
  expect(personIds.length, 'the viewer and one member to list').toBe(2);

  const tier = await service
    .from('membership_tier')
    .insert({ workspace_id: workspaceId, name: `${TAG} tier` })
    .select('id')
    .single();
  if (tier.error) throw new Error(`seed tier: ${tier.error.message}`);
  tierId = tier.data.id as string;

  for (const personId of personIds) {
    const m = await service
      .from('membership_member')
      .upsert(
        { workspace_id: workspaceId, person_id: personId, tier_id: tierId, status: 'active' },
        { onConflict: 'workspace_id,person_id' },
      )
      .select('id');
    if (m.error) throw new Error(`seed membership: ${m.error.message}`);
    const e = await service
      .from('membership_directory_entry')
      .upsert(
        { workspace_id: workspaceId, person_id: personId, listed: true, show_contact: true },
        { onConflict: 'workspace_id,person_id' },
      )
      .select('person_id');
    if (e.error) throw new Error(`seed directory entry: ${e.error.message}`);
  }

  const existing = await service
    .from('membership_settings')
    .select('*')
    .eq('workspace_id', workspaceId)
    .maybeSingle();
  if (existing.error) throw new Error(`read settings: ${existing.error.message}`);
  hadSettings = Boolean(existing.data);
  settingsBefore = existing.data ?? null;
  const on = await service
    .from('membership_settings')
    .upsert(
      { workspace_id: workspaceId, directory_enabled: true, directory_visibility: 'everybody' },
      { onConflict: 'workspace_id' },
    )
    .select('workspace_id');
  if (on.error) throw new Error(`seed settings: ${on.error.message}`);
});

test.afterAll(async () => {
  const service = stagingService();
  for (const personId of personIds) {
    await service
      .from('membership_directory_entry')
      .delete()
      .eq('workspace_id', workspaceId)
      .eq('person_id', personId);
    await service
      .from('membership_member')
      .delete()
      .eq('workspace_id', workspaceId)
      .eq('person_id', personId);
  }
  if (tierId) await service.from('membership_tier').delete().eq('id', tierId);
  if (hadSettings && settingsBefore) {
    await service.from('membership_settings').upsert(settingsBefore, { onConflict: 'workspace_id' });
  } else if (!hadSettings) {
    await service.from('membership_settings').delete().eq('workspace_id', workspaceId);
  }
});

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

test('the member list arrives in about a second, through either door', async ({ page }) => {
  test.slow();
  await landSignedIn(page, HOSTS.thread, 'the-thread', '/dashboard', /\/dashboard/);

  const timings: Record<string, number[]> = { '/members': [], [`/members/${workspaceId}`]: [] };
  // One unmeasured visit first: a cold function is the platform's cost, not
  // this page's, and it would land on whichever door happened to go first.
  await page.goto(`${HOSTS.my}/members/${workspaceId}`);
  for (let i = 0; i < 5; i++) {
    for (const path of Object.keys(timings)) {
      const start = Date.now();
      await page.goto(`${HOSTS.my}${path}`, { waitUntil: 'domcontentloaded' });
      // The server renders the list, so a row in the document is the list
      // having arrived — not a spinner, not the shell.
      await expect(page.getByRole('link', { name: /Esther Searchable/ })).toBeVisible({
        timeout: 30_000,
      });
      timings[path].push(Date.now() - start);
      // No redirect: the list is rendered at the address asked for. A
      // /members that lands on /members/<ws> is the old double render back.
      expect(new URL(page.url()).pathname).toBe(path);
    }
  }

  for (const [path, xs] of Object.entries(timings)) {
    console.log(`[members-speed] ${path.replace(workspaceId, '<ws>')}: median ${median(xs)}ms (${xs.join(', ')})`);
  }
  for (const [path, xs] of Object.entries(timings)) {
    expect(median(xs), `${path} median`).toBeLessThan(3_000);
  }
});
