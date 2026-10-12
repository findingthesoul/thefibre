// The per-field organisation merge, THROUGH THE SCREEN, on a pair shaped
// like the production one that broke.
//
// 2026-10-12: Sjoerd merged two organisations with per-field answers and got
// `column "id" does not exist`. The function assumed every child table's key
// was called `id`; `org_domain_verification`'s is `org_id`, and the merged
// organisation had a row in it. v1.162.1 fixed the function and an
// integration test covers it — but the thing he DID was press buttons, and
// nothing had pressed them on a pair carrying that row.
//
// So this walks it: Possible duplicates → "Same organisation, written twice"
// → the conflict dialog → "Merge with these answers", then Undo. The fixture
// pair carries what his did: six memberships on the merged row, one on the
// keeper, and a domain challenge on the merged row only.
//
// It writes, so it runs as the FIXTURE in its own workspace, and removes
// everything it made.

import { expect, test } from '@playwright/test';
import { HOSTS, fixtureIdentity, landSignedIn, stagingService, waitForListLoaded } from './helpers.js';

const TAG = 'e2e-merge-screen';
let ws = '';
const orgs: string[] = [];
const people: string[] = [];

test.beforeAll(async () => {
  const service = stagingService();
  ws = (await fixtureIdentity()).workspaceId;

  // SWEEP THIS SPEC'S EARLIER RUNS. Their rows are harmless in themselves,
  // but they put extra PAIRS in the queue, and a queue with other pairs in it
  // is what sent five locator attempts at the wrong card. Only rows this
  // spec named, only in the fixture workspace.
  const { data: stale } = await service
    .from('organisation')
    .select('id')
    .eq('workspace_id', ws)
    .ilike('name', `${TAG}%`);
  const staleIds = (stale ?? []).map((o) => o.id as string);
  if (staleIds.length) {
    await service.from('organisation_merge').delete().eq('workspace_id', ws);
    await service.from('org_domain_verification').delete().in('org_id', staleIds);
    await service.from('org_membership').delete().in('org_id', staleIds);
    await service.from('organisation_distinct').delete().in('a_id', staleIds);
    await service.from('organisation_distinct').delete().in('b_id', staleIds);
    await service.from('organisation').delete().in('id', staleIds);
  }
  await service.from('person').delete().eq('workspace_id', ws).ilike('first_name', `${TAG}%`);

  async function org(name: string, fields: Record<string, unknown>) {
    const { data, error } = await service
      .from('organisation')
      .insert({ workspace_id: ws, name, ...fields })
      .select('id')
      .single();
    if (error) throw new Error(`seed organisation: ${error.message}`);
    orgs.push(data!.id as string);
    return data!.id as string;
  }

  // Two names a human would see as the same company, which is also what puts
  // them in the queue: the matcher pairs them on the name.
  const keep = await org(`${TAG} Werkhaven`, { domain: 'e2e-merge-screen.nl' });
  const merge = await org(`${TAG} Werkhaven coöperatie U.A.`, {
    domain: 'E2E-merge-screen.nl',
    city: 'Zierikzee',
  });

  for (const n of [0, 1, 2, 3, 4, 5, 6]) {
    const { data, error } = await service
      .from('person')
      .insert({ workspace_id: ws, first_name: `${TAG}${n}`, last_name: 'Member' })
      .select('id')
      .single();
    if (error) throw new Error(`seed person: ${error.message}`);
    people.push(data!.id as string);
    const { error: mErr } = await service
      .from('org_membership')
      .insert({ org_id: n === 0 ? keep : merge, person_id: data!.id as string });
    if (mErr) throw new Error(`seed membership: ${mErr.message}`);
  }

  // THE ROW THAT BROKE IT, on the merged side only — his shape.
  const { error: dErr } = await service.from('org_domain_verification').insert({
    org_id: merge,
    workspace_id: ws,
    domain: 'E2E-merge-screen.nl',
    challenge: `${TAG}-challenge`,
  });
  if (dErr) throw new Error(`seed domain challenge: ${dErr.message}`);
}, 180_000);

test.afterAll(async () => {
  const service = stagingService();
  await service.from('organisation_merge').delete().eq('workspace_id', ws);
  if (orgs.length) {
    await service.from('org_domain_verification').delete().in('org_id', orgs);
    await service.from('org_membership').delete().in('org_id', orgs);
    await service.from('organisation_distinct').delete().in('a_id', orgs);
    await service.from('organisation').delete().in('id', orgs);
  }
  if (people.length) await service.from('person').delete().in('id', people);
}, 180_000);

test('a per-field merge goes through, and Undo puts it back', async () => {
  test.slow();
  // Through the API the screen calls, with the screen's own payload. The
  // browser half of this walk is the next step and is NOT what this asserts:
  // what it proves is that the route Sjoerd's click reaches now answers 201
  // instead of 400 on his pair's shape.
  const service = stagingService();
  const [keep, merge] = orgs;

  const { data: conflicts, error: cErr } = await service.rpc('organisation_merge_conflicts', {
    p_keep: keep,
    p_merge: merge,
  });
  expect(cErr?.message ?? null, 'the conflicts the dialog asks for').toBeNull();
  // The dialog only appears when there IS a disagreement; name and domain
  // differ here, which is what he was answering.
  expect(JSON.stringify(conflicts)).toContain('name');

  const { data: mergeId, error } = await service.rpc('merge_organisation', {
    p_keep: keep,
    p_merge: merge,
    p_actor: null,
    p_choices: { name: 'merge', domain: 'keep' },
  });
  expect(error?.message ?? null, 'the error he saw was column "id" does not exist').toBeNull();

  const { data: kept } = await service
    .from('organisation')
    .select('name, domain')
    .eq('id', keep)
    .single();
  expect(kept!.name).toBe(`${TAG} Werkhaven coöperatie U.A.`);
  expect(kept!.domain).toBe('e2e-merge-screen.nl');

  const { count: moved } = await service
    .from('org_membership')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', keep);
  expect(moved, 'all seven people on the kept organisation').toBe(7);

  const { error: undoErr } = await service.rpc('unmerge_organisation', {
    p_merge_id: mergeId as string,
    p_actor: null,
  });
  expect(undoErr?.message ?? null).toBeNull();

  const { count: back } = await service
    .from('org_membership')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', merge);
  expect(back, 'the six went back').toBe(6);

  // AND THE ANSWERED FIELDS GO BACK TOO. Checked because the next test
  // depends on it: the conflict dialog only opens when the two rows still
  // disagree, so an undo that left the keeper carrying the other row's name
  // would quietly change what that test is exercising.
  const { data: afterUndo } = await service
    .from('organisation')
    .select('name, domain')
    .eq('id', keep)
    .single();
  expect(afterUndo!.name, 'the keeper has its own name back').toBe(`${TAG} Werkhaven`);
  expect(afterUndo!.domain).toBe('e2e-merge-screen.nl');
}, 180_000);

test('the duplicates screen offers the pair, and the dialog asks about the name', async ({ page }) => {
  test.slow();
  await landSignedIn(page, HOSTS.fibre, 'fibre-platform', '/organisations/duplicates', /duplicates/);
  await waitForListLoaded(page);

  // The pair is in the queue, named by both sides.
  const body = page.locator('body');
  await expect(body).toContainText(`${TAG} Werkhaven`, { timeout: 30_000 });
  await expect(body).toContainText(`${TAG} Werkhaven coöperatie U.A.`);

  // The two answers the screen offers, in English (the fixture's locale).
  await expect(
    page.getByRole('button', { name: /Same organisation, written twice/ }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: /Different organisations, similar name/ }).first(),
  ).toBeVisible();
});

test('pressing the buttons: same organisation → merge with these answers → undo', async ({
  page,
}) => {
  test.slow();
  const service = stagingService();
  const [keep, merge] = orgs;

  await landSignedIn(page, HOSTS.fibre, 'fibre-platform', '/organisations/duplicates', /duplicates/);
  await waitForListLoaded(page);

  // The pair's own card, so a queue holding other pairs cannot mislead this.
  // Found by what it CONTAINS — the merged name and that button — rather than
  // by a tag: the first version guessed li/article/section and matched
  // nothing, because the card is a div.
  // THIS RUN'S PAIR CARD: the one linking to both of its ids. Not "the first
  // card", which is how five attempts ended up driving somebody else's pair.
  // `.first()`, not `.last()`: the OUTERMOST div that links to both ids is
  // the pair container, which holds the two answer buttons as well. The
  // innermost is the flex row of the two record cards, and the buttons are
  // its siblings — which is why a click on "Same organisation, written twice"
  // inside it waited 135 seconds for an element that was never in there.
  const card = page
    .locator('div')
    .filter({ has: page.locator(`a[href*="${keep}"]`) })
    .filter({ has: page.locator(`a[href*="${merge}"]`) })
    .first();
  await expect(card, 'the pair is in the queue, named by both ids').toBeVisible({
    timeout: 30_000,
  });

  await card.getByRole('button', { name: /Same organisation, written twice/ }).first().click();

  // Which one to keep. The keeper is the row WITHOUT the city, so the button
  // is found inside the half that names the keeper.
  const keepButtons = card.getByRole('button', { name: /Merge into this one/ });
  await expect(keepButtons.first()).toBeVisible({ timeout: 20_000 });
  // WHICH of the two "Merge into this one" buttons is the keeper's, asked of
  // the page rather than guessed at with locator filters — three attempts at
  // those matched a wrapper, or both halves (the keeper's name is a PREFIX of
  // the other's), or nothing. The city belongs to one record only, so each
  // button is asked what its own card says.
  // WHICH card is the keeper's: read the id out of each card's own link.
  // Every other way of telling them apart failed, each differently — a tag
  // guess, a name that is a prefix of the other name, an accent that may come
  // back decomposed, a wrapper div, a title read that returned the same text
  // twice. The href cannot be ambiguous.
  const hrefs = await keepButtons.evaluateAll((els) =>
    els.map((el) => {
      let cur: HTMLElement | null = el as HTMLElement;
      for (let i = 0; cur && i < 4; i++) {
        const a = cur.querySelector('a[href*="/organisations/"]');
        if (a) return a.getAttribute('href') ?? '';
        cur = cur.parentElement;
      }
      return '';
    }),
  );
  const keepIndex = hrefs.findIndex((h) => h.includes(keep));
  expect(
    keepIndex,
    `one card links to the keeper. hrefs: ${JSON.stringify(hrefs)}`,
  ).toBeGreaterThanOrEqual(0);
  await keepButtons.nth(keepIndex).click();

  // THE CONFLICT SURFACE IS INLINE, not a dialog: each answer is a button
  // saying which record it came from — "Keeping: <this one's value>" beside
  // "From: <the other's value>" — with "Merge with these answers" and "Back"
  // under them. Probed, after `getByRole('dialog')` found nothing.
  // Matched WITHOUT the accented word. The name is seeded from this file as
  // "coöperatie" with a composed ö; a value that comes back decomposed (o +
  // combining diaeresis) is a different string to a regex and matches
  // nothing, which is what the first attempt did.
  // "U.A." is ASCII and belongs only to the merged row's name, so this needs
  // no opinion about how "coöperatie" is encoded on the way back.
  // BY TEXT. `getByRole(name:)` matches the accessible name, and these
  // answer buttons carry their own aria-label, so the words on screen never
  // reach it — the probe could read them while the role matcher found
  // nothing. "U.A." is ASCII and belongs only to the merged row's name, so
  // this also needs no opinion about how "coöperatie" comes back encoded.
  const takeOther = card.locator('button').filter({ hasText: /^From:/ }).filter({
    hasText: /U\.A\./,
  });
  await expect(takeOther.first(), 'the name disagreement is offered').toBeVisible({
    timeout: 20_000,
  });
  // His answer: the longer name FROM the other record, and the domain kept.
  await takeOther.first().click();
  await expect(
    card.locator('button').filter({ hasText: /^Keeping:/ }).filter({
      hasText: /e2e-merge-screen\.nl/,
    }).first(),
    'the kept domain stays the keeper’s',
  ).toBeVisible();

  await card.locator('button').filter({ hasText: /^Merge with these answers$/ }).first().click();

  // NO ERROR BANNER — the thing he saw. Named explicitly, because a merge
  // that silently did nothing would also leave the dialog closed.
  await expect(page.locator('body')).not.toContainText('column "id" does not exist', {
    timeout: 20_000,
  });

  // And it really merged, asked of the database rather than of the page.
  await expect
    .poll(
      async () => {
        const { data } = await service
          .from('organisation')
          .select('deleted_at, merged_into')
          .eq('id', merge)
          .single();
        return data?.merged_into ?? null;
      },
      { timeout: 30_000, message: 'the merged organisation points at the keeper' },
    )
    .toBe(keep);

  const { count: moved } = await service
    .from('org_membership')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', keep);
  expect(moved, 'all seven people on the kept organisation').toBe(7);
  const { data: dv } = await service
    .from('org_domain_verification')
    .select('org_id')
    .in('org_id', [keep, merge]);
  expect(dv, 'the challenge moved with it').toHaveLength(1);
  expect(dv![0]!.org_id).toBe(keep);

  // UNDO, from the screen, under Recent merges.
  await page.reload();
  await waitForListLoaded(page);
  const undo = page.locator('button').filter({ hasText: /^Undo$/ }).first();
  await expect(undo, 'Recent merges offers an Undo').toBeVisible({ timeout: 30_000 });
  await undo.click();

  await expect
    .poll(
      async () => {
        const { data } = await service
          .from('organisation')
          .select('deleted_at, merged_into')
          .eq('id', merge)
          .single();
        return data?.merged_into ?? 'cleared';
      },
      { timeout: 30_000, message: 'the undo put the merged organisation back' },
    )
    .toBe('cleared');

  const { count: back } = await service
    .from('org_membership')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', merge);
  expect(back, 'the six went back').toBe(6);
});
