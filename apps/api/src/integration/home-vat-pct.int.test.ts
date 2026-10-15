// homeVatPct: the rate behind the small "€363 incl. 21% VAT" line under a
// public price (Sjoerd, 2026-10-16). It must say a rate exactly when the
// enrol and booking routes would ADD VAT for a buyer in the seller's home
// country — they share saleVat — and nothing otherwise, so the line can
// never promise VAT that is not charged, or hide VAT that is.
//
// Against staging's real VAT table, in a throwaway workspace whose seller
// details this test sets and clears.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createThrowawayWorkspace, deleteThrowawayWorkspace, service } from './staging.js';

let ws = '';

async function setWorkspaceVat(details: Record<string, unknown> | null) {
  const { error } = await service.from('workspace').update({ invoice_details: details }).eq('id', ws);
  if (error) throw new Error(`workspace invoice_details: ${error.message}`);
}

beforeAll(async () => {
  ws = await createThrowawayWorkspace('homevat');
});

afterAll(async () => {
  if (ws) await deleteThrowawayWorkspace(ws);
});

describe('homeVatPct', () => {
  it('is null for a seller that says nothing about VAT', async () => {
    const { homeVatPct } = await import('../lib/sale-vat.js');
    await setWorkspaceVat(null);
    expect(await homeVatPct({ workspaceId: ws })).toBeNull();
  });

  it('is the home rate the enrol route would add, for a VAT-registered seller', async () => {
    const { homeVatPct, saleVat } = await import('../lib/sale-vat.js');
    await setWorkspaceVat({ vat_registered: true, vat_rate_pct: 21 });
    const pct = await homeVatPct({ workspaceId: ws });
    expect(pct).toBeGreaterThan(0);
    // The same rule as a sale to a buyer in the seller's home country.
    const sale = await saleVat({ workspaceId: ws, net_cents: 30000, country: null });
    expect(pct).toBe(sale.rate_pct);
    expect(sale.gross_cents).toBe(30000 + Math.round((30000 * pct!) / 100));
  });

  it('is null again once the seller is marked not registered', async () => {
    const { homeVatPct } = await import('../lib/sale-vat.js');
    await setWorkspaceVat({ vat_registered: false });
    expect(await homeVatPct({ workspaceId: ws })).toBeNull();
  });
});
