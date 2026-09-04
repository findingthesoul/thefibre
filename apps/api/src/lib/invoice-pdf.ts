// The Fibre's own invoice PDF ("Download PDF opens Stripe" — Sjoerd,
// 2026-09-04: it must not). Drawn with pdfkit from a purchase-ledger row —
// the same facts the invoice page and receipt email render, in the same
// order: header, seller, buyer, line, subtotal/VAT/total, footer. Standard
// Helvetica only, so no font files ship with the image.

import PDFDocument from 'pdfkit';

export type PdfInvoice = {
  item_label: string;
  amount_cents: number;
  currency: string;
  status: string;
  method: string;
  paid_at: string | null;
  created_at: string;
  payer_name: string;
  payer_email: string | null;
  billing?: {
    number?: string | null;
    company?: string | null;
    address?: string | null;
    postal_code?: string | null;
    city?: string | null;
    country?: string | null;
    tax_no?: string | null;
    period_end?: string | null;
    subtotal_cents?: number | null;
    tax_cents?: number | null;
    tax_label?: string | null;
  } | null;
};

export type PdfSeller = { legal_name: string; address?: string; tax_no?: string };

const INK = '#171717';
const SUBTLE = '#525252';
const MUTED = '#737373';
const LINE = '#e5e5e2';

function money(cents: number, currency: string): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: currency || 'EUR' }).format(
    cents / 100,
  );
}

export function buildInvoicePdf(inv: PdfInvoice, seller: PdfSeller): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 56 });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const b = inv.billing ?? {};
    const settled = inv.status !== 'pending';
    const date = new Date(inv.paid_at ?? inv.created_at);
    const pageW = doc.page.width - 112; // both margins

    // Header ---------------------------------------------------------------
    doc.fillColor(INK).font('Helvetica-Bold').fontSize(22).text(settled ? 'Receipt' : 'Invoice', 56, 56);
    if (b.number) doc.font('Courier').fontSize(10).fillColor(MUTED).text(b.number, 56, 84);

    doc.font('Helvetica-Bold').fontSize(10).fillColor(INK).text(seller.legal_name, 56, 56, {
      width: pageW,
      align: 'right',
    });
    doc.font('Helvetica').fillColor(SUBTLE);
    if (seller.address) doc.text(seller.address, { width: pageW, align: 'right' });
    if (seller.tax_no) doc.text(`VAT: ${seller.tax_no}`, { width: pageW, align: 'right' });

    // Buyer + meta ----------------------------------------------------------
    let y = 130;
    doc.font('Helvetica').fontSize(7.5).fillColor(MUTED).text('BILLED TO', 56, y, { characterSpacing: 1 });
    doc.fontSize(10).fillColor(INK).text(b.company ?? inv.payer_name, 56, y + 12);
    const buyerAddress = [b.address, [b.postal_code, b.city].filter(Boolean).join(' '), b.country]
      .filter(Boolean)
      .join(', ');
    doc.fillColor(SUBTLE);
    if (buyerAddress) doc.text(buyerAddress, { width: pageW * 0.55 });
    if (b.tax_no) doc.text(`VAT: ${b.tax_no}`);
    if (inv.payer_email) doc.fillColor(MUTED).text(inv.payer_email);

    doc.fontSize(7.5).fillColor(MUTED).text('DATE', 56 + pageW * 0.65, y, { characterSpacing: 1 });
    doc.fontSize(10).fillColor(INK).text(
      date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
      56 + pageW * 0.65,
      y + 12,
    );
    doc.fontSize(7.5).fillColor(MUTED).text('PAYMENT', 56 + pageW * 0.65, y + 32, { characterSpacing: 1 });
    doc.fontSize(10).fillColor(INK).text(
      `${inv.method === 'stripe' ? 'Card' : inv.method === 'invoice' ? 'By invoice' : inv.method} · ${inv.status}`,
      56 + pageW * 0.65,
      y + 44,
    );

    // Line items ------------------------------------------------------------
    y = 240;
    const right = 56 + pageW;
    const amountAt = (val: string, yy: number, bold = false) => {
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').text(val, 56, yy, { width: pageW, align: 'right' });
    };
    doc.moveTo(56, y).lineTo(right, y).strokeColor(LINE).stroke();
    y += 12;
    doc.font('Helvetica').fontSize(10).fillColor(INK);
    const label =
      inv.item_label +
      (b.period_end
        ? `  (service until ${new Date(b.period_end).toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })})`
        : '');
    doc.text(label, 56, y, { width: pageW * 0.7 });
    amountAt(money(b.subtotal_cents ?? inv.amount_cents, inv.currency), y);
    y += 26;

    if (typeof b.tax_cents === 'number' && (b.tax_cents > 0 || b.tax_label)) {
      doc.moveTo(56, y - 8).lineTo(right, y - 8).strokeColor(LINE).stroke();
      doc.fillColor(SUBTLE).text(b.tax_label ?? 'VAT', 56, y);
      doc.fillColor(SUBTLE);
      amountAt(money(b.tax_cents, inv.currency), y);
      y += 26;
    }

    doc.moveTo(56, y - 8).lineTo(right, y - 8).strokeColor(LINE).stroke();
    doc.font('Helvetica-Bold').fontSize(12).fillColor(INK).text(`Total (${inv.currency})`, 56, y);
    doc.fontSize(12);
    amountAt(money(inv.amount_cents, inv.currency), y, true);

    // Footer ----------------------------------------------------------------
    const footY = doc.page.height - 90;
    doc.moveTo(56, footY).lineTo(right, footY).strokeColor(LINE).stroke();
    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor(MUTED)
      .text(
        `${seller.legal_name}${seller.address ? ` · ${seller.address}` : ''} · Hosted in the EU`,
        56,
        footY + 10,
        { width: pageW },
      );

    doc.end();
  });
}
