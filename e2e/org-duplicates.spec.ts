import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { HOSTS, fixtureIdentity, landSignedIn, stagingService, waitForHydration } from './helpers.js';

// Organisations → Duplicates, in a browser.
//
// The routes behind this screen have integration tests and the per-field
// chooser has unit coverage. Neither answers the question this file is for:
// does a person opening the page see two organisations, the reason they were
// proposed, the question, the per-field step — and does pressing the buttons
// actually merge, dismiss and undo? A screen can be wired correctly and
// render an empty page, and an empty queue looks exactly like a working one.
// So every pair is SEEDED and asserted present by name before anything is
// clicked.
//
// Fixture identity only — the dedicated e2e account, an admin of its own
// fixture workspace, so the admin gate opens nowhere near a real person's
// data.
//
// ── Each test seeds its OWN pair, and that is not tidiness ──────────────────
//
// The first version seeded one pair in beforeAll and shared it. Two things
// went wrong, and the second is the one worth remembering:
//
//   1. The tests were order-dependent. The merge test left the pair merged if
//      it failed halfway, and the dismissal test then ran against a pair that
//      was no longer proposed.
//   2. Playwright RE-RUNS beforeAll on a retry. The retry seeded a second
//      copy of the same pair without the first being gone, so four
//      organisations with two names existed, the finder proposed several
//      pairs, and the page showed the same name in more than one card. The
//      assertion that caught it — "there is exactly one card for this
//      organisation" — then failed for a reason that had nothing to do with
//      the screen. A fixture that is not idempotent fails as a product bug.
//
// So: a unique pair per test, every id tracked, and the workspace swept of
// this spec's leftovers before seeding in case a previous run died mid-test.

const TRACKED: string[] = [];
let workspaceId = '';

type Pair = { keepId: string; dropId: string; keep: string; drop: string };

/** Two organisations that the finder is certain to propose, in the fixture
 *  workspace. A shared domain is its strongest rule — reason 'same domain',
 *  score 1.0 — so this does not depend on a trigram threshold. They disagree
 *  about city, which is what makes the per-field step appear at all: a blank
 *  on one side is a free fill, not a question. */
async function seedPair(label: string): Promise<Pair> {
  const s = stagingService();
  const tag = randomUUID().slice(0, 6);
  const keep = `E2E ${label} Keep ${tag} BV`;
  const drop = `E2E ${label} Drop ${tag} BV`;
  const domain = `e2e-dup-${tag}.example`;

  const mk = async (name: string, city: string) => {
    const { data, error } = await s
      .from('organisation')
      .insert({ workspace_id: workspaceId, name, domain, city })
      .select('id')
      .single();
    if (error) throw new Error(`e2e organisation ${name}: ${error.message}`);
    TRACKED.push(data!.id as string);
    return data!.id as string;
  };
  return { keep, drop, keepId: await mk(keep, 'Amsterdam'), dropId: await mk(drop, 'Rotterdam') };
}

test.beforeAll(async () => {
  const me = await fixtureIdentity();
  workspaceId = me.workspaceId;

  // Sweep anything this spec left behind on a run that died mid-test. Scoped
  // to our own name prefix in our own fixture workspace — it never touches a
  // row another spec or a person made.
  const s = stagingService();
  const { data: stale } = await s
    .from('organisation')
    .select('id')
    .eq('workspace_id', workspaceId)
    .like('name', 'E2E %Keep %BV');
  const { data: stale2 } = await s
    .from('organisation')
    .select('id')
    .eq('workspace_id', workspaceId)
    .like('name', 'E2E %Drop %BV');
  const ids = [...(stale ?? []), ...(stale2 ?? [])].map((r) => r.id as string);
  if (ids.length) {
    await s.from('organisation_merge').delete().eq('workspace_id', workspaceId).in('kept_org_id', ids);
    await s.from('organisation_distinct').delete().eq('workspace_id', workspaceId).in('a_id', ids);
    await s.from('organisation').delete().in('id', ids);
  }
});

test.afterAll(async () => {
  if (!workspaceId || !TRACKED.length) return;
  const s = stagingService();
  // Each step independently: a chain that throws halfway leaves rows on
  // staging, which is how fifteen workspaces were left there on 2026-10-09.
  const step = async (what: string, run: () => Promise<{ error: unknown }>) => {
    try {
      const { error } = await run();
      if (error) console.error(`[e2e cleanup] ${what}: ${(error as Error).message}`);
    } catch (e) {
      console.error(`[e2e cleanup] ${what}: ${(e as Error).message}`);
    }
  };
  await step('organisation_merge', () =>
    s.from('organisation_merge').delete().eq('workspace_id', workspaceId).in('kept_org_id', TRACKED),
  );
  await step('organisation_distinct', () =>
    s.from('organisation_distinct').delete().eq('workspace_id', workspaceId).in('a_id', TRACKED),
  );
  await step('organisation', () => s.from('organisation').delete().in('id', TRACKED));
});

/**
 * The card for one organisation. Both cards carry an identical "Merge into
 * this one" button, so this has to name the right card rather than the first
 * button on the page.
 *
 * `div.flex-1` alone is NOT enough, and finding that out is the reason this
 * comment exists: the app shell's main column is `flex-1 flex flex-col
 * min-w-0`, so it matches too and contains every card on the page. The
 * selector reported two matches, which read exactly like the queue rendering
 * a duplicate card — I rewrote the fixture on that theory before printing
 * what had actually matched, which took one probe and would have taken one
 * probe at the start. `rounded-md` is what distinguishes the card root.
 */
function card(page: import('@playwright/test').Page, name: string) {
  return page.locator('div.flex-1.rounded-md', { has: page.getByRole('link', { name }) });
}

/**
 * The whole pair block for OUR pair — the bordered box holding both cards,
 * the question and the conflict step.
 *
 * Every click goes through this rather than through `.first()` on the page.
 * The queue holds every pair the workspace has, ordered by score, so `.first()`
 * is whichever pair happens to sort first, not ours: a same-domain pair scores
 * 1.0 and so does any other, and the order between them is not ours to
 * predict. Pressing "Same organisation" on somebody else's pair and then
 * asserting against ours produced a failure that read as a missing heading.
 */
function pairBlock(page: import('@playwright/test').Page, name: string) {
  return page.locator('div.rounded-lg.border', { has: page.getByRole('link', { name }) });
}

async function openQueue(page: import('@playwright/test').Page) {
  await landSignedIn(
    page,
    HOSTS.fibre,
    'fibre-platform',
    '/organisations/duplicates',
    /\/organisations\/duplicates/,
  );
  await waitForHydration(page);
}

async function cityOf(id: string): Promise<string | null> {
  const { data } = await stagingService()
    .from('organisation')
    .select('city')
    .eq('id', id)
    .maybeSingle();
  return (data?.city as string | null) ?? null;
}

test.describe('Organisations → Duplicates', () => {
  test('proposes the pair, asks per field, merges and undoes', async ({ page }) => {
    const p = await seedPair('Merge');
    await openQueue(page);

    // 1. The pair is THERE. Asserted by name, because "no errors on the page"
    //    is also true of an empty one.
    await expect(page.getByRole('link', { name: p.keep })).toBeVisible();
    await expect(page.getByRole('link', { name: p.drop })).toBeVisible();
    // Exactly one card each: a duplicated card would make every click below
    // ambiguous, and it is better to say so here than to click the wrong one.
    await expect(card(page, p.keep)).toHaveCount(1);
    // The reason, in words rather than the function's raw string.
    await expect(page.getByText('Same website domain').first()).toBeVisible();
    // The people count — the number that usually settles which record is real.
    await expect(card(page, p.keep).getByText('nobody yet')).toBeVisible();

    // 2. The question, and the answer that leads to a merge.
    const block = pairBlock(page, p.keep);
    await expect(block).toHaveCount(1);
    await expect(block.getByText('Same organisation, or two different ones?')).toBeVisible();
    await block.getByRole('button', { name: /Same organisation, written twice/i }).click();

    // 3. Choosing the keeper asks what the two disagree about. This pair
    //    disagrees about city, so the step MUST appear — if it does not,
    //    either the conflicts route or the chooser is broken, and this is the
    //    only place that would notice.
    await card(page, p.keep).getByRole('button', { name: /Merge into this one/i }).click();

    await expect(block.getByText(/These two say different things/i)).toBeVisible();

    // Each heading appears THREE times on purpose and that is not a bug to
    // route around: once in the header row, and once inside each value button
    // as a phone-only label, because the header row is `hidden sm:grid` and a
    // reader on a phone would otherwise not know which record a value came
    // from. So the header row's copy is named specifically — asserting
    // "is visible" against all three is ambiguous by construction.
    const headerRow = block.locator('div.sm\\:grid').first();
    await expect(headerRow.getByText(`Keeping: ${p.keep}`)).toBeVisible();
    await expect(headerRow.getByText(`From: ${p.drop}`)).toBeVisible();

    // The column is spelled as a word, not as a database name.
    await expect(block.getByText('city', { exact: true })).toBeVisible();
    // Both values offered, and the keeper's pre-selected — the safety of the
    // whole feature: pressing straight through does what a plain merge did.
    const other = block.getByRole('button', { name: 'Rotterdam' });
    await expect(block.getByRole('button', { name: 'Amsterdam' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(other).toHaveAttribute('aria-pressed', 'false');

    // The question has been answered, so the screen must stop asking it.
    // Looked at in a browser at 1280 and at 375: the "which record do you
    // keep" explainer stayed below the open step with its own Back, putting
    // two Back links a few millimetres apart — one closing the step, one
    // leaving the choice — and on a phone the stale paragraph sat directly
    // under "Merge with these answers".
    await expect(block.getByText(/Which record do you keep as the main one/i)).toBeHidden();
    await expect(block.getByRole('button', { name: /Same organisation, written twice/i })).toBeHidden();
    await expect(block.getByRole('button', { name: /^Back$/ })).toHaveCount(1);

    // 4. Choose the OTHER record's city, then merge. This is the point of the
    //    feature: a value from the record being merged away wins, because
    //    somebody said so.
    await other.click();
    await expect(other).toHaveAttribute('aria-pressed', 'true');
    await block.getByRole('button', { name: /Merge with these answers/i }).click();

    // 5. Read the DATABASE, not the page: the screen could show anything, and
    //    what matters is what was written.
    await expect
      .poll(() => cityOf(p.keepId), {
        timeout: 20_000,
        message: 'the chosen city should reach the kept organisation',
      })
      .toBe('Rotterdam');
    const { data: dropped } = await stagingService()
      .from('organisation')
      .select('deleted_at, merged_into')
      .eq('id', p.dropId)
      .maybeSingle();
    expect(dropped?.deleted_at).not.toBeNull();
    expect(dropped?.merged_into).toBe(p.keepId);

    // 6. And it can be taken back, from the same screen.
    await expect(page.getByRole('heading', { name: /Recent merges/i })).toBeVisible();
    await page.getByRole('button', { name: /^Undo$/ }).first().click();

    await expect
      .poll(() => cityOf(p.keepId), {
        timeout: 20_000,
        message: 'undo should put the overwritten city back',
      })
      .toBe('Amsterdam');
  });

  test('“different organisations” dismisses the pair for good', async ({ page }) => {
    // The route this exercises did not exist until v1.151.0:
    // organisation_distinct has been honoured by the finder since 2026-09-23
    // with nothing able to write a row, so the queue could only be merged
    // away, never answered.
    const p = await seedPair('Distinct');
    await openQueue(page);

    await expect(page.getByRole('link', { name: p.keep })).toBeVisible();
    await pairBlock(page, p.keep)
      .getByRole('button', { name: /Different organisations, similar name/i })
      .click();

    // Gone from the queue, and remembered in the database — a card
    // disappearing on its own would also happen if the click merely hid it.
    await expect(page.getByRole('link', { name: p.keep })).toBeHidden();
    const [lo, hi] = [p.keepId, p.dropId].sort();
    await expect
      .poll(
        async () => {
          const { count } = await stagingService()
            .from('organisation_distinct')
            .select('a_id', { count: 'exact', head: true })
            .eq('workspace_id', workspaceId)
            .eq('a_id', lo)
            .eq('b_id', hi);
          return count ?? 0;
        },
        { timeout: 20_000, message: 'the dismissal should be stored' },
      )
      .toBe(1);

    // And it stays gone on a fresh load, which is the actual promise.
    await page.reload();
    await waitForHydration(page);
    await expect(page.getByRole('link', { name: p.keep })).toBeHidden();
  });
});
