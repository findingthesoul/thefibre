import { test, expect } from '@playwright/test';
import { HOSTS, landSignedIn } from './helpers.js';

// Settings → Your domain (docs/domain-package.md), opened as the fixture.
//
// The fixture's workspace (`e2e-fixtures`) is on the Free plan, so what this
// proves is the plan-gated face of the page: it renders, it says in words
// that sending from your own domain is Pro and up, and it offers the plan
// page — not a form that 402s on submit. The registering flow itself talks
// to the mail provider and is exercised by hand on staging (the spec that
// registers a domain we own is release 3's follow-up).
//
// Looks only; presses nothing that commits.

test('Your domain opens for the fixture and explains the plan', async ({ page }) => {
  await landSignedIn(page, HOSTS.fibre, 'fibre-platform', '/settings/domain', /\/settings\/domain/);
  const body = page.locator('body');
  await expect(body).not.toContainText('Application error');
  await expect(body).not.toContainText(/API (4|5)\d\d/);
  await expect(page.getByRole('heading', { name: /your domain|je domein/i })).toBeVisible();
  await expect(body).toContainText(/part of Pro|hoort bij Pro/);
  await expect(page.getByRole('link', { name: /see your plan|bekijk je plan/i })).toHaveAttribute('href', '/settings/plan');
});

test('the settings hub lists Your domain for a workspace admin', async ({ page }) => {
  await landSignedIn(page, HOSTS.fibre, 'fibre-platform', '/settings', /\/settings$/);
  await expect(page.getByRole('link', { name: /your domain|je domein/i })).toHaveAttribute('href', '/settings/domain');
});
