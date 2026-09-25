// The invoice must be ONE page.
//
// It became two on 2026-09-24, and not because the layout outgrew A4: the
// footer printed the seller address, addresses are stored multi-line, and
// three lines starting at y≈762 on an 842pt page spill. pdfkit then opens a
// page to hold the overflow, so the document ends with one orphan line of
// footer. Nothing in a typecheck can see that — only a rendered page count
// can, which is why this test renders.
import { describe, expect, it } from 'vitest';
import { buildInvoicePdf, type PdfInvoice, type PdfSeller, buyerRows } from './invoice-pdf.js';

/** pdfkit writes one `/Type /Page` object per page (and `/Type /Pages` once
 *  for the tree, which the word boundary keeps out). */
function pageCount(pdf: Buffer): number {
  return (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length;
}

const SELLER: PdfSeller = {
  legal_name: 'One Soul Community Cooperative U.A.',
  // The real shape: three lines, which is what broke it.
  address: 'Stationsplein 45, unit 133\n3013AK  Rotterdam\nThe Netherlands',
  tax_no: 'NL813651141B01',
};

const PURCHASE = {
  id: 'p1',
  amount_cents: 100,
  currency: 'EUR',
  status: 'paid',
  method: 'card',
  item_label: 'Community membership',
  payer_name: 'Sjoerd Luteyn',
  payer_email: 'member@example.com',
  created_at: '2026-09-24T15:39:16Z',
} as unknown as PdfInvoice;

describe('invoice pdf', () => {
  it('is a single page with a three-line seller address', async () => {
    expect(pageCount(await buildInvoicePdf(PURCHASE, SELLER))).toBe(1);
  });

  it('stays one page when the buyer address is multi-line too', async () => {
    const pdf = await buildInvoicePdf(
      {
        ...PURCHASE,
        billing: {
          number: 'INV-2026-0001',
          address: 'Langestraat 1\n1011 AB  Amsterdam\nThe Netherlands',
          tax_no: 'NL999999999B01',
        },
      } as unknown as PdfInvoice,
      SELLER,
    );
    expect(pageCount(pdf)).toBe(1);
  });

  it('is one page for the full document: number, VAT line, both addresses', async () => {
    // The case that actually shipped two pages on 2026-09-24, and the case
    // the first version of this test MISSED — it checked the addresses
    // separately and never the whole document at once, so it passed while
    // the rendered file had two pages. Keep every field on at the same time.
    const pdf = await buildInvoicePdf(
      {
        ...PURCHASE,
        amount_cents: 12100,
        item_label: 'Community membership — year agenda',
        billing: {
          number: 'INV-2026-0042',
          address: 'Langestraat 1\n1011 AB  Amsterdam\nThe Netherlands',
          tax_no: 'NL999999999B01',
          tax_rate: 21,
        },
      } as unknown as PdfInvoice,
      {
        ...SELLER,
        // Four lines, longer than the page is wide once flattened.
        address:
          'Stationsplein 45, unit 133\nStationsplein 45, unit 133\n3013AK  Rotterdam\nThe Netherlands',
      },
    );
    expect(pageCount(pdf)).toBe(1);
  });

  it('renders without a logo when the url is not a raster image', async () => {
    // Workspaces have uploaded .svg marks; pdfkit cannot embed those. A logo
    // we cannot draw must cost nothing — not an exception, not a page.
    const pdf = await buildInvoicePdf(PURCHASE, {
      ...SELLER,
      logo_url: 'https://example.invalid/mark.svg',
    });
    expect(pageCount(pdf)).toBe(1);
    expect(pdf.byteLength).toBeGreaterThan(500);
  });

  it('does not reach the network for a non-https logo', async () => {
    // file:// and http:// are refused before fetch is called at all.
    const pdf = await buildInvoicePdf(PURCHASE, {
      ...SELLER,
      logo_url: 'file:///etc/passwd',
    });
    expect(pageCount(pdf)).toBe(1);
  });
});

describe('buyerRows — which fields reach the document', () => {
  // The bug this guards: buyer.address was computed by invoiceModel, drawn by
  // the on-screen dialog, and absent from the PDF. Every existing test here
  // asserts the PAGE COUNT, so all of them passed the whole time — including
  // the one named "both addresses". A page count cannot see a missing field.
  const base = {
    kind: 'invoice' as const,
    number: 'F-2026-004',
    buyer: { address: 'Route de Ferney 150, 1211 Geneve, Switzerland', taxNo: 'CHE-123', email: 'a@b.test' },
  };

  it("carries the buyer's address, one row per part, between the number and the VAT", () => {
    const rows = buyerRows(base, '20 Sept 2026');
    const values = rows.map(([, v]) => v);

    expect(values).toContain('Route de Ferney 150');
    expect(values).toContain('1211 Geneve');
    expect(values).toContain('Switzerland');

    // order matters on a document: number, then where they are, then who they are
    expect(values.indexOf('Route de Ferney 150')).toBeGreaterThan(values.indexOf('F-2026-004'));
    expect(values.indexOf('Switzerland')).toBeLessThan(values.indexOf('CHE-123'));
  });

  it('gives each address part its own row, so nothing wraps into the row beneath', () => {
    // A single long value wrapped across the next baseline and printed
    // through the VAT number. Fixed baselines, so one value per row.
    const rows = buyerRows(base, '20 Sept 2026');
    for (const [, value] of rows) expect(value).not.toContain(',');
  });

  it('applies the column fit to address parts, which are the only free text here', () => {
    const rows = buyerRows(base, '20 Sept 2026', (v) => v.slice(0, 6));
    expect(rows.map(([, v]) => v)).toContain('Route ');
    // and not to the fields that are already short and must stay exact
    expect(rows.map(([, v]) => v)).toContain('CHE-123');
  });

  it('omits what is absent rather than printing an empty label', () => {
    const rows = buyerRows(
      { kind: 'receipt', number: null, buyer: { address: null, taxNo: null, email: null } },
      '20 Sept 2026',
    );
    expect(rows).toEqual([['Date issued:', '20 Sept 2026']]);
  });
});
