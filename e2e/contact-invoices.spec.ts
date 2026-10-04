import { test, expect } from '@playwright/test';
import { HOSTS, landSignedInAsOwner, stagingService } from './helpers.js';
import { resolveOwnerIdentity } from './identities.js';

// A contact's Invoices tab (v0.75.14), through the real signed-in screen on
// STAGING. The filter was proven against PostgREST; this is the layer above
// it — the tab appearing only when it has something to show, and the shared
// invoices list rendering that person's rows.
//
// Fixtures are READ, never written: a person in the OWNER's workspace (the
// `default` one, e2e/identities.ts) who has a purchase, and one who has none. If staging stops having
// either, the test says so rather than passing on nothing.

async function fixtureWorkspacePeople() {
  const service = stagingService();
  // The workspace by what it IS, not "the oldest user's": that lookup is how
  // the pack once became a different person without anybody choosing it.
  const { workspaceId } = await resolveOwnerIdentity(service);

  const { data: bought } = await service
    .from('purchase')
    .select('person_id, item_label')
    .eq('workspace_id', workspaceId)
    .not('person_id', 'is', null)
    .limit(1);
  const withInvoice = bought?.[0] as { person_id: string; item_label: string } | undefined;

  const { data: people } = await service
    .from('person')
    .select('id, email')
    .eq('workspace_id', workspaceId)
    .is('deleted_at', null)
    .limit(50);
  const { data: allBuyers } = await service
    .from('purchase')
    .select('person_id, payer_email')
    .eq('workspace_id', workspaceId);
  const buyerIds = new Set((allBuyers ?? []).map((r) => r.person_id).filter(Boolean));
  const buyerEmails = new Set(
    (allBuyers ?? []).map((r) => String(r.payer_email ?? '').toLowerCase()).filter(Boolean),
  );
  const withoutInvoice = (people ?? []).find(
    (p) => !buyerIds.has(p.id) && !buyerEmails.has(String(p.email ?? '').toLowerCase()),
  );

  return { withInvoice, withoutInvoiceId: withoutInvoice?.id as string | undefined };
}

test.describe("a contact's invoices (v0.75.14)", () => {
  test('a person with an invoice gets the tab, and it lists their purchase', async ({ page }) => {
    const { withInvoice } = await fixtureWorkspacePeople();
    expect(withInvoice, 'staging fixture workspace has no purchase with a person').toBeTruthy();

    await landSignedInAsOwner(page, HOSTS.fibre, 'fibre-platform', `/contacts/${withInvoice!.person_id}`, /\/contacts\//);
    const tab = page.locator(`a[href="/contacts/${withInvoice!.person_id}/invoices"]`);
    await expect(tab).toHaveCount(1);

    await tab.click();
    await page.waitForURL(/\/invoices$/, { timeout: 30_000 });
    await expect(page.getByText(withInvoice!.item_label).first()).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('body')).not.toContainText('Application error');
  });

  test('a person with no invoice gets no tab', async ({ page }) => {
    const { withoutInvoiceId } = await fixtureWorkspacePeople();
    expect(withoutInvoiceId, 'staging fixture workspace has no person without a purchase').toBeTruthy();

    await landSignedInAsOwner(page, HOSTS.fibre, 'fibre-platform', `/contacts/${withoutInvoiceId}`, /\/contacts\//);
    await expect(page.locator(`a[href="/contacts/${withoutInvoiceId}/invoices"]`)).toHaveCount(0);
  });
});
