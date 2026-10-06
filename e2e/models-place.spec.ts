import { test, expect } from '@playwright/test';
import { HOSTS, fixtureIdentity, landSignedIn, stagingService, waitForHydration } from './helpers.js';

// A business model opens where this person left it (v1.107.0).
//
// Sjoerd, 2026-10-06: "remember the page one was on in the Model (which tab
// and which view), per user. When logging in and opening a model, it would be
// great if you get there immediately." The place is one row per (person,
// model) in models_place, written by the page 600 ms after a change and read
// back by GET /models/:id, so the server renders the model already on it.
//
// This spec seeds a workspace-wide model in the fixture workspace (the fixture
// is an admin there and holds a seat in Business Models), opens it, goes to
// Numbers → Per month, and then opens the model again in a FRESH browser
// context with no query string, the way the dashboard links to it. The second
// visit must start on Numbers → Per month. The row is checked too, and both
// rows are removed at the end.

const SEED = {
  name: 'E2E place check (do not edit)',
  slug: 'e2e-place-check',
  definition: {
    name: 'E2E place check',
    currency: 'EUR',
    currencySymbol: '€',
    unitLabel: 'members',
    horizon: 24,
    generators: [{
      id: 'members', name: 'Members', inputs: [
        { id: 'fee', label: 'Monthly fee', unit: 'EUR / member', value: 40, step: 5 },
        { id: 'start', label: 'Members in month one', unit: 'members', value: 30, step: 5 },
        { id: 'growth', label: 'Monthly growth', unit: '%', value: 5, step: 0.5 },
        { id: 'churn', label: 'Monthly churn', unit: '%', value: 2, step: 0.5 },
      ],
      volume: { start: 'start', growth: 'growth', churn: 'churn' }, revenuePerUnit: 'fee', costs: [],
    }],
    fixedCosts: [{ id: 'team', label: 'Team', value: 1000, step: 100 }],
  },
};

test('a model reopens on the tab and view this person left it on, in a fresh browser', async ({ page, browser }) => {
  test.slow();
  const service = stagingService();
  const me = await fixtureIdentity();

  // Idempotent seed: one model with this slug in the fixture workspace.
  await service.from('models_model').delete().eq('workspace_id', me.workspaceId).eq('slug', SEED.slug);
  const { data: model, error: seedErr } = await service
    .from('models_model')
    .insert({ workspace_id: me.workspaceId, team_id: null, slug: SEED.slug, name: SEED.name, definition: SEED.definition, inputs: {}, created_by: me.userRowId, updated_by: me.userRowId })
    .select('id')
    .single();
  expect(seedErr, 'the model row is seeded').toBeNull();
  const id = model!.id as string;

  try {
    // First visit: the canvas, then Numbers → Per month.
    await landSignedIn(page, HOSTS.models, 'fibre-models', `/models/${id}`, new RegExp(`/models/${id}`));
    await waitForHydration(page, '[role=tab]');
    await expect(page.getByRole('tab', { name: /^(canvas|lienzo|tela|canevas)$/i })).toHaveAttribute('aria-selected', 'true');
    await page.getByRole('tab', { name: /^(numbers|cijfers|cifras|números|zahlen|chiffres)$/i }).click();
    await page.getByRole('button', { name: /^(per month|per maand|por mes|por mês|pro monat|par mois)$/i }).click();
    await expect(page.getByRole('heading', { name: /^(inputs per month|invoer per maand|entradas por mes|entradas por mês|eingaben pro monat|saisies par mois)/i })).toBeVisible();
    await expect(page).toHaveURL(/tab=numbers&view=periods/);

    // The row, not the screen: what the next visit will read.
    await expect.poll(async () => {
      const { data } = await service.from('models_place').select('tab, view').eq('model_id', id).eq('user_id', me.userRowId).maybeSingle();
      return data ? `${data.tab}/${data.view}` : null;
    }, { timeout: 15_000, message: 'the place is written to models_place' }).toBe('numbers/periods');

    // Second visit: a fresh browser, no query string, as from the dashboard.
    const fresh = await browser.newContext();
    const page2 = await fresh.newPage();
    try {
      await landSignedIn(page2, HOSTS.models, 'fibre-models', `/models/${id}`, new RegExp(`/models/${id}`));
      await waitForHydration(page2, '[role=tab]');
      await expect(page2.getByRole('tab', { name: /^(numbers|cijfers|cifras|números|zahlen|chiffres)$/i })).toHaveAttribute('aria-selected', 'true');
      // The chip carries its state in its class, not in aria; the grid it opens is the proof.
      await expect(page2.getByRole('heading', { name: /^(inputs per month|invoer per maand|entradas por mes|entradas por mês|eingaben pro monat|saisies par mois)/i })).toBeVisible();
      await expect(page2).toHaveURL(/tab=numbers&view=periods/);
    } finally {
      await fresh.close();
    }
  } finally {
    await service.from('models_place').delete().eq('model_id', id);
    await service.from('models_model').delete().eq('id', id);
  }
});
