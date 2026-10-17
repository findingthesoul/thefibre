import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { HOSTS, fixtureIdentity, landSignedIn, stagingService, waitForHydration } from './helpers.js';

// A contact's page, its addresses and an organisation's page, in a browser.
//
// Written for F2 (security): routes/persons.ts and routes/organisations.ts
// moved onto the tenant accessor, and the cross-workspace int tests prove the
// refusals. This proves the other half through the real screen on deployed
// staging: the fixture admin still sees their own person and organisation,
// and an address added in the edit dialog lands in the database, in the
// fixture workspace, with person.email still on the primary.
//
// Fixture identity only. The person and the organisation are created here and
// removed afterwards; nothing on this path writes an activity row.

const people: string[] = [];
const orgs: string[] = [];
let workspaceId = '';

test.beforeAll(async () => {
  workspaceId = (await fixtureIdentity()).workspaceId;
});

test.afterAll(async () => {
  const s = stagingService();
  const step = async (what: string, run: () => PromiseLike<{ error: unknown }>) => {
    try {
      const { error } = await run();
      if (error) console.error(`[e2e cleanup] ${what}: ${(error as Error).message}`);
    } catch (e) {
      console.error(`[e2e cleanup] ${what}: ${(e as Error).message}`);
    }
  };
  if (people.length) {
    await step('person_contact_point', () => s.from('person_contact_point').delete().in('person_id', people));
    await step('person', () => s.from('person').delete().in('id', people));
  }
  if (orgs.length) await step('organisation', () => s.from('organisation').delete().in('id', orgs));
});

test.describe('Contacts, after F2', () => {
  test('a contact page shows the person, and an added address is saved in this workspace', async ({ page }) => {
    const s = stagingService();
    const tag = randomUUID().slice(0, 6);
    const first = `e2e-cp-first-${tag}@example.com`;
    const second = `e2e-cp-second-${tag}@example.com`;
    const { data, error } = await s
      .from('person')
      .insert({ workspace_id: workspaceId, first_name: 'Points', last_name: `E2E${tag}`, email: first })
      .select('id')
      .single();
    if (error) throw new Error(`e2e person: ${error.message}`);
    const id = data!.id as string;
    people.push(id);

    await landSignedIn(page, HOSTS.fibre, 'fibre-platform', `/contacts/${id}`, new RegExp(`/contacts/${id}`));
    await waitForHydration(page);
    await expect(page.getByText(`E2E${tag}`).first()).toBeVisible();
    await expect(page.getByText(first).first()).toBeVisible();

    await page.getByRole('button', { name: /^Edit$/ }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: /\+ Add email/ }).click();
    const emails = dialog.getByRole('textbox', { name: /^Email$/ });
    await expect(emails).toHaveCount(2);
    await emails.nth(1).fill(second);
    await dialog.getByRole('button', { name: /Save changes/ }).click();
    await expect(dialog).toBeHidden();

    // On the page, and — the point — in the table, stamped with our workspace.
    await expect(page.getByText(second).first()).toBeVisible();
    const { data: points, error: pErr } = await s
      .from('person_contact_point')
      .select('value, workspace_id, is_primary')
      .eq('person_id', id)
      .eq('kind', 'email')
      .order('value');
    if (pErr) throw new Error(`contact points: ${pErr.message}`);
    expect(points!.map((p) => p.value).sort()).toEqual([first, second].sort());
    expect(points!.every((p) => p.workspace_id === workspaceId)).toBe(true);
    const { data: row } = await s.from('person').select('email').eq('id', id).single();
    expect(row!.email).toBe(first);
  });

  test("an organisation's page shows the organisation", async ({ page }) => {
    const s = stagingService();
    const name = `E2E Points Org ${randomUUID().slice(0, 6)}`;
    const { data, error } = await s
      .from('organisation')
      .insert({ workspace_id: workspaceId, name })
      .select('id')
      .single();
    if (error) throw new Error(`e2e organisation: ${error.message}`);
    const id = data!.id as string;
    orgs.push(id);

    await landSignedIn(page, HOSTS.fibre, 'fibre-platform', `/organisations/${id}`, new RegExp(`/organisations/${id}`));
    await waitForHydration(page);
    await expect(page.getByText(name).first()).toBeVisible();
  });
});
