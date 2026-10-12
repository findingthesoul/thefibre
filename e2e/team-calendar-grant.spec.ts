// The admin field that writes a team-calendar grant — by pressing buttons.
//
// The rule is pinned by unit tests on both sides (blank = 100, 0 refused,
// 1..100 whole), and that is the part that can be tested cheaply. What those
// cannot show is whether an admin can actually SAY "this team's calendar is
// free for members": whether the kind is offered, whether the picker has the
// teams in it, whether the sentence beside the number is the right one, and
// whether the row that lands in the database is the row the form promised.
//
// The one that nearly shipped wrong here before: the Access section sits at
// the bottom of a tall dialog, and this app has already had a control that
// rendered correctly 610px down a 492px window — present, populated and
// invisible. So the geometry is measured, not assumed.
//
// Signs in as the E2E FIXTURE (never a real person) and removes everything it
// makes, including grants it created through the form.

import { expect, test } from '@playwright/test';
import {
  HOSTS,
  fixtureIdentity,
  landSignedIn,
  stagingService,
  waitForHydration,
} from './helpers.js';

const TAG = 'e2e-team-cal';
let ws = '';
let productId = '';
let teamId = '';
let hiddenTeamId = '';

test.beforeAll(async () => {
  const service = stagingService();
  const identity = await fixtureIdentity();
  ws = identity.workspaceId;

  // An earlier run's rows first, so a stale product cannot be the one under
  // test and grants cannot pile up.
  const { data: stale } = await service
    .from('membership_product')
    .select('id')
    .eq('workspace_id', ws)
    .like('name', `${TAG}%`);
  for (const p of stale ?? []) {
    await service.from('membership_access_grant').delete().eq('product_id', p.id);
    await service.from('membership_product').delete().eq('id', p.id);
  }
  const { data: staleTeams } = await service
    .from('team')
    .select('id')
    .eq('workspace_id', ws)
    .like('slug', `${TAG}%`);
  if (staleTeams?.length) {
    await service.from('team').delete().in(
      'id',
      staleTeams.map((t) => t.id),
    );
  }

  const ins = async (table: string, row: Record<string, unknown>) => {
    const { data, error } = await service.from(table).insert(row).select('id').single();
    if (error) throw new Error(`seed ${table}: ${error.message}`);
    return data!.id as string;
  };
  productId = await ins('membership_product', { workspace_id: ws, name: `${TAG} product` });
  teamId = await ins('team', {
    workspace_id: ws,
    name: `${TAG} choir`,
    slug: `${TAG}-choir`,
    is_active: true,
    is_published: true,
  });
  // A second team that is NOT published: its threads are not public at all,
  // so the picker says so rather than offering it as if it were ready.
  hiddenTeamId = await ins('team', {
    workspace_id: ws,
    name: `${TAG} draft group`,
    slug: `${TAG}-draft-group`,
    is_active: true,
    is_published: false,
  });
});

test.afterAll(async () => {
  const service = stagingService();
  if (productId) {
    await service.from('membership_access_grant').delete().eq('product_id', productId);
    await service.from('membership_product').delete().eq('id', productId);
  }
  for (const id of [teamId, hiddenTeamId].filter(Boolean)) {
    await service.from('team').delete().eq('id', id);
  }
});

/** The open dialog. Scoped on purpose: the product card BEHIND it repeats the
 *  grant's words in its "unlocks" line and is clickable, so an unscoped
 *  locator by name matched two elements and the click refused. */
function dialog(page: import('@playwright/test').Page) {
  return page.getByRole('dialog');
}

async function openProduct(page: import('@playwright/test').Page) {
  await landSignedIn(page, HOSTS.membership, 'membership', '/products', /\/products|no-access/);
  await waitForHydration(page, 'button');
  await page.getByText(`${TAG} product`, { exact: true }).first().click();
  await page.getByText(/Access/i).first().waitFor({ state: 'attached' });
}

function kindSelect(page: import('@playwright/test').Page) {
  // The select that has the kind as an option — there are several selects in
  // this dialog and only one of them is this.
  return page
    .locator('select')
    .filter({ has: page.locator('option', { hasText: 'Team calendar' }) })
    .first();
}

test('an admin can say "this team’s calendar is free for members"', async ({ page }) => {
  test.slow();
  const service = stagingService();
  await openProduct(page);

  // 1. THE KIND IS OFFERED. It is only in the list because the workspace has
  //    teams — the form hides it otherwise rather than showing a picker with
  //    nothing in it.
  const kinds = kindSelect(page);
  // Scrolled to, because that is what a person does with a section near the
  // bottom of a tall dialog. How FAR down it is, is measured below.
  await kinds.scrollIntoViewIfNeeded();
  await expect(kinds, 'the kind select is in the Access row').toBeVisible();
  await kinds.selectOption('team_calendar');

  // 2. HOW FAR DOWN IT IS — measured, not assumed, because this app has
  //    already shipped a control that rendered correctly 610px down a 492px
  //    window and was reported as missing. Recorded rather than asserted:
  //    which section a tall dialog puts below the fold is a design decision,
  //    and moving this one up only pushes another one down. The number goes
  //    in the run output so the decision can be made on a number.
  const geometry = await page.evaluate(() => {
    const el = [...document.querySelectorAll('select')].find((s) =>
      [...s.options].some((o) => /Team calendar/i.test(o.textContent || '')),
    );
    if (!el) return null;
    const scroller = el.closest('[class*="overflow"]');
    const r = el.getBoundingClientRect();
    const sr = scroller?.getBoundingClientRect();
    if (!sr) return null;
    return {
      offsetInsideDialog: Math.round(r.top - sr.top),
      visibleAreaHeight: Math.round(sr.height),
      visible: r.top >= sr.top && r.bottom <= sr.top + sr.height,
    };
  });
  console.log(`[team-cal] kind select geometry: ${JSON.stringify(geometry)}`);

  // 3. THE SENTENCE BESIDE THE NUMBER, before anything is picked: the field
  //    starts at 100 and says what 100 means, which is the whole point of
  //    labelling it rather than leaving a bare number.
  const body = page.locator('body');
  await expect(body, '100 reads as free, not as "100% off"').toContainText(
    /100% — free for members/i,
  );

  // 4. THE PICKER HAS THE TEAMS, and says which one is not published.
  await dialog(page).getByRole('button', { name: /Pick a team/i }).click();
  const option = dialog(page).getByRole('button', { name: new RegExp(`${TAG} choir`) });
  await expect(option, 'the published team is offered').toBeVisible();
  await expect(body, 'and the unpublished one is marked as such').toContainText(/not published/i);
  await option.click();

  // 5. ADD IT. The row that lands is the row the form promised.
  await dialog(page).getByRole('button', { name: /Add access/i }).click();
  await expect
    .poll(
      async () => {
        const { data } = await service
          .from('membership_access_grant')
          .select('kind, config')
          .eq('product_id', productId);
        return data ?? [];
      },
      { timeout: 20_000, message: 'the grant is written' },
    )
    .toEqual([{ kind: 'team_calendar', config: { team_id: teamId, discount_pct: 100 } }]);

  // 6. AND THE LIST SAYS IT IN WORDS, with the team's NAME — a uuid in a list
  //    of what a product confers is a row nobody can check.
  await expect(body, 'the summary names the team and what members pay').toContainText(
    new RegExp(`${TAG} choir calendar — free for members`, 'i'),
  );
  expect(geometry, 'the kind select was found').not.toBeNull();
  // The honest assertion: reachable. A person scrolls; the control works when
  // they get there. If this ever stops being true the field is unusable, and
  // that IS a bug — unlike sitting below the fold, which is a layout choice
  // somebody has to make about a dialog with eight sections.
  await expect(kinds, 'and it works once scrolled to').toBeVisible();
});

test('0% is refused in the FORM, with the reason, and writes nothing', async ({ page }) => {
  test.slow();
  const service = stagingService();
  const before = await service
    .from('membership_access_grant')
    .select('id')
    .eq('product_id', productId);
  const countBefore = (before.data ?? []).length;

  await openProduct(page);
  await kindSelect(page).scrollIntoViewIfNeeded();
  await kindSelect(page).selectOption('team_calendar');
  await dialog(page).getByRole('button', { name: /Pick a team/i }).click();
  await dialog(page).getByRole('button', { name: new RegExp(`${TAG} choir`) }).click();

  const pct = dialog(page).locator('input[type="number"]').first();
  await pct.fill('0');
  const body = page.locator('body');
  // The hint changes AS IT IS TYPED — before Add is pressed, before any
  // request. A refusal that only arrives from the API is a round trip to
  // learn what the form already knew.
  await expect(body, 'the form says why 0 is not a discount').toContainText(
    /0% promises nothing/i,
  );

  await dialog(page).getByRole('button', { name: /Add access/i }).click();
  await page.waitForTimeout(2_000);
  const after = await service
    .from('membership_access_grant')
    .select('id, config')
    .eq('product_id', productId);
  console.log(`[team-cal] grants after pressing Add on 0%: ${JSON.stringify(after.data)}`);
  expect((after.data ?? []).length, 'nothing was written').toBe(countBefore);

  // And a real percentage goes through, so the refusal is about 0 and not
  // about the form being stuck.
  await pct.fill('20');
  await expect(body, '20 reads as a discount').toContainText(/20% off for members/i);
  await dialog(page).getByRole('button', { name: /Add access/i }).click();
  await expect
    .poll(
      async () => {
        const { data } = await service
          .from('membership_access_grant')
          .select('config')
          .eq('product_id', productId);
        return (data ?? []).map((g) => (g.config as { discount_pct?: number }).discount_pct);
      },
      { timeout: 20_000, message: 'the 20% grant is written' },
    )
    .toContain(20);
  await expect(body, 'and the list says 20% off').toContainText(
    new RegExp(`${TAG} choir calendar — 20% off`, 'i'),
  );
});

test('at 375 the Access row FITS — no sideways scroll, nothing clipped', async ({ page }) => {
  test.slow();
  // Found by looking at staging, not by reasoning about classes: the row put
  // the kind select, the two-field team block and the Add button side by side,
  // which came to 416px of content in a 373px dialog. "Add access" was cut off
  // at the right edge and the dialog scrolled sideways. The row now wraps at
  // this width and stays one line from `sm` up.
  await page.setViewportSize({ width: 375, height: 812 });
  await openProduct(page);
  const kinds = kindSelect(page);
  await kinds.scrollIntoViewIfNeeded();
  await kinds.selectOption('team_calendar');

  const fit = await page.evaluate(() => {
    const scroller = [...document.querySelectorAll('[role="dialog"] div')].find(
      (d) => d.scrollHeight > d.clientHeight + 20 && getComputedStyle(d).overflowY === 'auto',
    );
    if (!scroller) return null;
    const add = [...document.querySelectorAll('[role="dialog"] button')].find((b) =>
      /Add access/i.test(b.textContent || ''),
    );
    const sr = scroller.getBoundingClientRect();
    const ar = add?.getBoundingClientRect();
    return {
      clientWidth: scroller.clientWidth,
      scrollWidth: scroller.scrollWidth,
      addRight: ar ? Math.round(ar.right) : null,
      scrollerRight: Math.round(sr.right),
    };
  });
  console.log(`[team-cal] 375 fit: ${JSON.stringify(fit)}`);
  expect(fit, 'the dialog scroller was found').not.toBeNull();
  expect(
    fit!.scrollWidth,
    `the dialog must not scroll sideways on a phone — ${fit!.scrollWidth}px of content in ${fit!.clientWidth}px`,
  ).toBeLessThanOrEqual(fit!.clientWidth + 1);
  expect(fit!.addRight, 'the Add access button was found').not.toBeNull();
  expect(
    fit!.addRight!,
    'and it sits inside the dialog rather than off its right edge',
  ).toBeLessThanOrEqual(fit!.scrollerRight + 1);

  // The field still works at this width, which is the point of it fitting.
  await expect(page.locator('body')).toContainText(/100% — free for members/i);
});

test('a team from ANOTHER workspace is refused by the route, and nothing is written', async ({
  page,
}) => {
  test.slow();
  const service = stagingService();
  const API = 'https://thefibre-api-staging.fly.dev';

  // A real team in a workspace the fixture has nothing to do with. Picked
  // from what is already on staging rather than created: the point is that
  // the id is VALID and simply not theirs, and a workspace this fixture does
  // not administer is exactly what makes it a tenancy question. Nothing is
  // written to it and nothing about it is read beyond its id.
  const { data: foreign } = await service
    .from('team')
    .select('id, workspace_id')
    .neq('workspace_id', ws)
    .eq('is_active', true)
    .limit(1);
  const foreignTeam = foreign?.[0];
  expect(foreignTeam, 'staging has a team in another workspace to try').toBeTruthy();

  // Signed in as the fixture admin, and the request carries THEIR session —
  // this is an authorised caller of their own workspace, naming somebody
  // else's team. Not an attack from outside; the case the form cannot reach.
  await landSignedIn(page, HOSTS.membership, 'membership', '/products', /\/products|no-access/);
  await waitForHydration(page, 'button');
  const token = await page.evaluate(() => {
    const raw = document.cookie
      .split('; ')
      .filter((c) => /^sb-.*-auth-token(\.\d+)?=/.test(c))
      .sort()
      .map((c) => c.slice(c.indexOf('=') + 1))
      .join('');
    if (!raw) return null;
    const json = raw.startsWith('base64-')
      ? atob(raw.slice(7))
      : decodeURIComponent(raw);
    try {
      return (JSON.parse(json) as { access_token?: string }).access_token ?? null;
    } catch {
      return null;
    }
  });
  expect(token, 'the signed-in fixture has a token in the browser').toBeTruthy();

  const before = await service
    .from('membership_access_grant')
    .select('id')
    .eq('product_id', productId);

  const res = await page.request.post(`${API}/api/v1/membership/grants`, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'X-App-ID': 'membership',
    },
    data: {
      product_id: productId,
      kind: 'team_calendar',
      config: { team_id: foreignTeam!.id, discount_pct: 100 },
    },
  });
  const body = await res.text();
  console.log(`[team-cal] foreign team POST: ${res.status()} ${body.slice(0, 200)}`);
  expect(res.status(), 'the route refuses it').toBe(400);
  expect(body, 'and says so without confirming the team exists').toContain(
    'no such team in this workspace',
  );

  const after = await service
    .from('membership_access_grant')
    .select('id, config')
    .eq('product_id', productId);
  expect((after.data ?? []).length, 'nothing was written').toBe((before.data ?? []).length);

  // And the same call with THIS workspace's team goes through, so a passing
  // refusal cannot mean "the route refuses everything" — the failure mode
  // that makes a security test look green while the feature is broken.
  const ok = await page.request.post(`${API}/api/v1/membership/grants`, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'X-App-ID': 'membership',
    },
    data: { product_id: productId, kind: 'team_calendar', config: { team_id: teamId } },
  });
  console.log(`[team-cal] own team POST: ${ok.status()}`);
  expect(ok.status(), 'its own team is accepted').toBe(201);
  const { data: written } = await service
    .from('membership_access_grant')
    .select('config')
    .eq('product_id', productId);
  expect(
    (written ?? []).map((g) => (g.config as { team_id?: string }).team_id),
    'and the row that landed is the OWN team, with the blank-means-100 default',
  ).toContain(teamId);
  expect(
    (written ?? []).some((g) => (g.config as { discount_pct?: number }).discount_pct === 100),
    'blank percentage stored as 100 by the API, as the form would have',
  ).toBe(true);
});
