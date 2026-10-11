import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { HOSTS, fixtureIdentity, landSignedIn, stagingService, waitForHydration } from './helpers.js';

// Organisations → Duplicates, in a browser.
//
// The routes behind this screen have integration tests, and the per-field
// chooser has unit coverage. Neither answers the question this file is for:
// does a person opening the page see two organisations, the reason they were
// proposed, the question, the per-field step, and does pressing the buttons
// actually merge and undo? A screen can be wired correctly and render an
// empty page — and an empty queue looks exactly like a working one, which is
// the trap this repo has fallen into before (feedback: assert non-empty).
//
// So the pair is SEEDED and then asserted present by name before anything is
// clicked.
//
// Fixture identity only — the dedicated e2e account, which is an admin of its
// own fixture workspace, so the admin gate opens without going anywhere near
// a real person's data. Two organisations are created in that workspace and
// both are removed afterwards, along with the merge audit and any dismissal.

const TAG = randomUUID().slice(0, 6);
const KEEP = `E2E Dup Keep ${TAG} BV`;
const DROP = `E2E Dup Drop ${TAG} BV`;
const DOMAIN = `e2e-dup-${TAG}.example`;

let workspaceId = '';
const made: string[] = [];

test.beforeAll(async () => {
  const s = stagingService();
  const me = await fixtureIdentity();
  workspaceId = me.workspaceId;

  // A shared domain is the candidates function's strongest rule — reason
  // 'same domain', score 1.0 — so the pair is certain to be proposed rather
  // than depending on a trigram threshold.
  //
  // The two disagree about city and differ on legal name, which is what makes
  // the per-field step appear at all: a blank on one side is a free fill, not
  // a question.
  const mk = async (name: string, fields: Record<string, unknown>) => {
    const { data, error } = await s
      .from('organisation')
      .insert({ workspace_id: workspaceId, name, domain: DOMAIN, ...fields })
      .select('id')
      .single();
    if (error) throw new Error(`e2e organisation ${name}: ${error.message}`);
    made.push(data!.id as string);
    return data!.id as string;
  };
  await mk(KEEP, { city: 'Amsterdam', legal_name: `${KEEP} (keeper)` });
  await mk(DROP, { city: 'Rotterdam', legal_name: `${DROP} (other)` });
});

test.afterAll(async () => {
  const s = stagingService();
  // Each independently: a chain that throws halfway leaves rows on staging,
  // which is how fifteen workspaces were left there on 2026-10-09.
  const step = async (what: string, run: () => Promise<{ error: unknown }>) => {
    try {
      const { error } = await run();
      if (error) console.error(`[e2e cleanup] ${what}: ${(error as Error).message}`);
    } catch (e) {
      console.error(`[e2e cleanup] ${what}: ${(e as Error).message}`);
    }
  };
  if (!workspaceId || !made.length) return;
  await step('organisation_merge', () =>
    s.from('organisation_merge').delete().eq('workspace_id', workspaceId).in('kept_org_id', made),
  );
  await step('organisation_distinct', () =>
    s.from('organisation_distinct').delete().eq('workspace_id', workspaceId).in('a_id', made),
  );
  await step('organisation', () => s.from('organisation').delete().in('id', made));
});

test.describe('Organisations → Duplicates', () => {
  test('proposes the pair, asks per field, merges and undoes', async ({ page }) => {
    await landSignedIn(
      page,
      HOSTS.fibre,
      'fibre-platform',
      '/organisations/duplicates',
      /\/organisations\/duplicates/,
    );
    await waitForHydration(page);

    // 1. The pair is THERE. Asserted by name, because "no errors on the page"
    //    is also true of an empty one.
    await expect(page.getByRole('link', { name: KEEP })).toBeVisible();
    await expect(page.getByRole('link', { name: DROP })).toBeVisible();
    // The reason chip, in words rather than the function's raw string.
    await expect(page.getByText('Same website domain').first()).toBeVisible();

    // 2. The question, and the answer that leads to a merge.
    await expect(page.getByText('Same organisation, or two different ones?')).toBeVisible();
    await page.getByRole('button', { name: /Same organisation, written twice/i }).click();

    // 3. Choosing the keeper asks what the two disagree about. The pair
    //    disagrees about city and legal name, so the step MUST appear — if it
    //    does not, either the conflicts route or the chooser is broken, and
    //    this is the only place that would notice.
    // The card root, by the class it actually carries — `locator('div', …)`
    // matches every ancestor div that contains the link, and picking one by
    // position is the kind of selector that breaks the next time a wrapper is
    // added. Both cards carry an identical "Merge into this one" button, so
    // this has to name the right card rather than the first button on the page.
    const keepCard = page.locator('div.flex-1', {
      has: page.getByRole('link', { name: KEEP }),
    });
    await expect(keepCard).toHaveCount(1);
    await keepCard.getByRole('button', { name: /Merge into this one/i }).click();

    await expect(page.getByText(/These two say different things/i)).toBeVisible();
    await expect(page.getByText(`Keeping: ${KEEP}`)).toBeVisible();
    await expect(page.getByText(`From: ${DROP}`)).toBeVisible();
    // The column is spelled as a word, not as a database name.
    await expect(page.getByText('city', { exact: true }).first()).toBeVisible();
    // Both values are offered, and the keeper's is pre-selected.
    const rotterdam = page.getByRole('button', { name: 'Rotterdam' });
    await expect(page.getByRole('button', { name: 'Amsterdam' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(rotterdam).toHaveAttribute('aria-pressed', 'false');

    // 4. Choose the OTHER record's city, then merge. This is the whole point
    //    of the feature: a value from the record being merged away wins,
    //    because somebody said so.
    await rotterdam.click();
    await expect(rotterdam).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: /Merge with these answers/i }).click();

    // 5. The kept record now holds the chosen city, and the other is gone.
    //    Read from the database rather than from the page: the screen could
    //    show anything, and what matters is what was written.
    const s = stagingService();
    await expect
      .poll(
        async () => {
          const { data } = await s
            .from('organisation')
            .select('city')
            .eq('id', made[0])
            .maybeSingle();
          return (data?.city as string | null) ?? null;
        },
        { timeout: 15_000, message: 'the chosen city should reach the kept organisation' },
      )
      .toBe('Rotterdam');
    const { data: dropped } = await s
      .from('organisation')
      .select('deleted_at, merged_into')
      .eq('id', made[1])
      .maybeSingle();
    expect(dropped?.deleted_at).not.toBeNull();
    expect(dropped?.merged_into).toBe(made[0]);

    // 6. And it can be taken back, from the same screen.
    await expect(page.getByRole('heading', { name: /Recent merges/i })).toBeVisible();
    await page.getByRole('button', { name: /^Undo$/ }).first().click();

    await expect
      .poll(
        async () => {
          const { data } = await s
            .from('organisation')
            .select('city')
            .eq('id', made[0])
            .maybeSingle();
          return (data?.city as string | null) ?? null;
        },
        { timeout: 15_000, message: 'undo should put the overwritten city back' },
      )
      .toBe('Amsterdam');
  });

  test('“different organisations” dismisses the pair for good', async ({ page }) => {
    // The route this exercises did not exist until slice 4: organisation_distinct
    // has been honoured by the candidates function since 2026-09-23 with
    // nothing able to write a row, so the queue could only be merged away.
    await landSignedIn(
      page,
      HOSTS.fibre,
      'fibre-platform',
      '/organisations/duplicates',
      /\/organisations\/duplicates/,
    );
    await waitForHydration(page);

    await expect(page.getByRole('link', { name: KEEP })).toBeVisible();
    await page.getByRole('button', { name: /Different organisations, similar name/i }).click();

    // Gone from the queue, and remembered in the database — the card
    // disappearing on its own would also happen if the click merely hid it.
    await expect(page.getByRole('link', { name: KEEP })).toBeHidden();
    const s = stagingService();
    const [lo, hi] = [...made].sort();
    await expect
      .poll(
        async () => {
          const { count } = await s
            .from('organisation_distinct')
            .select('a_id', { count: 'exact', head: true })
            .eq('workspace_id', workspaceId)
            .eq('a_id', lo)
            .eq('b_id', hi);
          return count ?? 0;
        },
        { timeout: 15_000, message: 'the dismissal should be stored' },
      )
      .toBe(1);

    // And it stays gone on a fresh load, which is the actual promise.
    await page.reload();
    await waitForHydration(page);
    await expect(page.getByRole('link', { name: KEEP })).toBeHidden();
  });
});
