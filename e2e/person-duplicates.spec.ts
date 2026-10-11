import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { HOSTS, fixtureIdentity, landSignedIn, stagingService, waitForHydration } from './helpers.js';

// Contacts → Duplicates, in a browser.
//
// Written for one thing: the per-field step must not leave the question it
// answered on screen underneath it. The organisation twin had that bug, it
// was found by looking rather than by any test, and this screen has had it
// since the step shipped — so this spec is what stops it coming back here.
//
// It deliberately does NOT merge. Opening the step is enough to see the bug,
// and a merge on this screen writes a hygiene_finding answer and a
// person_merge row; the organisation spec covers the merge path end to end
// and there is no reason to rehearse it twice against real tables.
//
// Fixture identity only — the dedicated e2e account, an admin of its own
// fixture workspace. Both people are created here and removed afterwards.

const TRACKED: string[] = [];
let workspaceId = '';

type Pair = { keepId: string; dropId: string; keep: string; drop: string; email: string };

/** Two people the finder is certain to propose: a shared email address is its
 *  strongest rule (`same_email`), so this does not depend on a trigram
 *  threshold. They disagree about city, which is what makes the per-field
 *  step appear at all — a blank on one side is a free fill, not a question. */
async function seedPair(): Promise<Pair> {
  const s = stagingService();
  const tag = randomUUID().slice(0, 6);
  const email = `e2e-dup-${tag}@example.com`;
  const keep = `Marieke E2EKeep${tag}`;
  const drop = `Marieke E2EDrop${tag}`;

  const mk = async (first: string, last: string, city: string) => {
    const { data, error } = await s
      .from('person')
      .insert({ workspace_id: workspaceId, first_name: first, last_name: last, email, city })
      .select('id')
      .single();
    if (error) throw new Error(`e2e person ${first} ${last}: ${error.message}`);
    TRACKED.push(data!.id as string);
    return data!.id as string;
  };
  return {
    keep,
    drop,
    email,
    keepId: await mk('Marieke', `E2EKeep${tag}`, 'Amsterdam'),
    dropId: await mk('Marieke', `E2EDrop${tag}`, 'Rotterdam'),
  };
}

test.beforeAll(async () => {
  workspaceId = (await fixtureIdentity()).workspaceId;
});

test.afterAll(async () => {
  if (!workspaceId || !TRACKED.length) return;
  const s = stagingService();
  // Each step independently: a chain that throws halfway leaves rows behind.
  const step = async (what: string, run: () => Promise<{ error: unknown }>) => {
    try {
      const { error } = await run();
      if (error) console.error(`[e2e cleanup] ${what}: ${(error as Error).message}`);
    } catch (e) {
      console.error(`[e2e cleanup] ${what}: ${(e as Error).message}`);
    }
  };
  await step('hygiene_finding', () =>
    s.from('hygiene_finding').delete().eq('workspace_id', workspaceId).in('subject_id', TRACKED),
  );
  await step('person_merge', () =>
    s.from('person_merge').delete().eq('workspace_id', workspaceId).in('kept_person_id', TRACKED),
  );
  await step('activity', () => s.from('activity').delete().in('person_id', TRACKED));
  await step('person', () => s.from('person').delete().in('id', TRACKED));
});

test.describe('Contacts → Duplicates', () => {
  test('the per-field step replaces the question it answered', async ({ page }) => {
    const p = await seedPair();

    await landSignedIn(
      page,
      HOSTS.fibre,
      'fibre-platform',
      '/contacts/duplicates',
      /\/contacts\/duplicates/,
    );
    await waitForHydration(page);

    // The pair is THERE, asserted by name: an empty queue renders exactly
    // like a working one, so everything below would "pass" against nothing.
    //
    // `div.rounded-lg.border` is the pair block. Scoped to OUR pair rather
    // than `.first()` on the page — the queue holds every pair the workspace
    // has, ordered by score, and whichever sorts first is not ours to
    // predict. (The organisation spec learned that one the slow way.)
    const block = page.locator('div.rounded-lg.border', {
      has: page.getByRole('link', { name: p.keep }),
    });
    await expect(block).toHaveCount(1);
    await expect(block.getByRole('link', { name: p.drop })).toBeVisible();

    // Same person → choose a keeper → the step opens, because the two
    // disagree about city.
    await block.getByRole('button', { name: /Same person, different roles/i }).click();
    await block
      .locator('div.flex-1.rounded-md', { has: page.getByRole('link', { name: p.keep }) })
      .getByRole('button', { name: /Merge into this one/i })
      .click();
    await expect(block.getByText(/These two say different things/i)).toBeVisible();

    // THE POINT. Before v1.151.2 all three of these were wrong: the explainer
    // stayed, the Same/Different buttons stayed, and there were two Back
    // links a few millimetres apart — one closing the step, one leaving the
    // choice. At phone width the stale paragraph sat directly under "Merge
    // with these answers", which is the button somebody is reaching for.
    await expect(block.getByText(/Which record do you keep as the main one/i)).toBeHidden();
    await expect(block.getByRole('button', { name: /Same person, different roles/i })).toBeHidden();
    await expect(block.getByRole('button', { name: /Different people, same name/i })).toBeHidden();
    await expect(block.getByRole('button', { name: /^Back$/ })).toHaveCount(1);

    // And Back still works: it closes the step, which puts the keeper choice
    // back. The guard hides the answered question while the step is open; it
    // does not remove the way out of the step.
    await block.getByRole('button', { name: /^Back$/ }).click();
    await expect(block.getByText(/These two say different things/i)).toBeHidden();
  });
});
