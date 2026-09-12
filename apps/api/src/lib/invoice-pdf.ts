// The Fibre's own invoice PDF ("Download PDF opens Stripe" — Sjoerd,
// 2026-09-04: it must not). Drawn with pdfkit from the shared invoice model
// — header, seller, buyer, line, subtotal/VAT/total, footer. Standard
// Helvetica only, so no font files ship with the image.
//
// WHAT this document contains is decided once, in
// @thefibre/shared/invoice-model, and shared with the invoice email and the
// on-screen dialog. This file decides only how it LOOKS on A4. The three
// used to derive the facts separately and had drifted (2026-09-09).

import PDFDocument from 'pdfkit';
import { invoiceModel, type InvoicePurchase, type InvoiceSeller } from '@thefibre/shared';

export type PdfInvoice = InvoicePurchase;
export type PdfSeller = InvoiceSeller & { legal_name: string };

const INK = '#171717';
const SUBTLE = '#525252';
const MUTED = '#737373';
const LINE = '#e5e5e2';

/** How this document words each payment method. The email words them its
 *  own way; the model decides which method it IS, not what to call it. */
const PDF_METHOD: Record<string, string> = {
  card: 'Card',
  invoice: 'By invoice',
  invoice_awaiting: 'By invoice',
  free: 'Free',
};

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

    const m = invoiceModel(inv, seller);
    const date = new Date(m.dateIso);
    const pageW = doc.page.width - 112; // both margins

    // Header ---------------------------------------------------------------
    doc
      .fillColor(INK)
      .font('Helvetica-Bold')
      .fontSize(22)
      .text(m.kind === 'receipt' ? 'Receipt' : 'Invoice', 56, 56);
    if (m.number) doc.font('Courier').fontSize(10).fillColor(MUTED).text(m.number, 56, 84);

    doc.font('Helvetica-Bold').fontSize(10).fillColor(INK).text(m.seller.name, 56, 56, {
      width: pageW,
      align: 'right',
    });
    doc.font('Helvetica').fillColor(SUBTLE);
    if (m.seller.address) doc.text(m.seller.address, { width: pageW, align: 'right' });
    if (m.seller.taxNo) doc.text(`VAT: ${m.seller.taxNo}`, { width: pageW, align: 'right' });

    // Buyer + meta ----------------------------------------------------------
    let y = 130;
    doc.font('Helvetica').fontSize(7.5).fillColor(MUTED).text('BILLED TO', 56, y, { characterSpacing: 1 });
    doc.fontSize(10).fillColor(INK).text(m.buyer.name, 56, y + 12);
    doc.fillColor(SUBTLE);
    if (m.buyer.address) doc.text(m.buyer.address, { width: pageW * 0.55 });
    if (m.buyer.taxNo) doc.text(`VAT: ${m.buyer.taxNo}`);
    if (m.buyer.email) doc.fillColor(MUTED).text(m.buyer.email);

    doc.fontSize(7.5).fillColor(MUTED).text('DATE', 56 + pageW * 0.65, y, { characterSpacing: 1 });
    doc.fontSize(10).fillColor(INK).text(
      date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
      56 + pageW * 0.65,
      y + 12,
    );
    doc.fontSize(7.5).fillColor(MUTED).text('PAYMENT', 56 + pageW * 0.65, y + 32, { characterSpacing: 1 });
    doc.fontSize(10).fillColor(INK).text(
      `${PDF_METHOD[m.method] ?? m.raw.method} · ${m.raw.status}`,
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
      m.line.label +
      (m.line.serviceUntilIso
        ? `  (service until ${new Date(m.line.serviceUntilIso).toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })})`
        : '');
    doc.text(label, 56, y, { width: pageW * 0.7 });
    amountAt(money(m.line.amountCents, m.currency), y);
    y += 26;

    if (m.totals.tax) {
      doc.moveTo(56, y - 8).lineTo(right, y - 8).strokeColor(LINE).stroke();
      doc.fillColor(SUBTLE).text(m.totals.tax.label ?? 'VAT', 56, y);
      doc.fillColor(SUBTLE);
      amountAt(money(m.totals.tax.amountCents, m.currency), y);
      y += 26;
    }

    doc.moveTo(56, y - 8).lineTo(right, y - 8).strokeColor(LINE).stroke();
    doc.font('Helvetica-Bold').fontSize(12).fillColor(INK).text(`Total (${m.currency})`, 56, y);
    doc.fontSize(12);
    amountAt(money(m.totals.totalCents, m.currency), y, true);

    // Footer ----------------------------------------------------------------
    const footY = doc.page.height - 90;
    doc.moveTo(56, footY).lineTo(right, footY).strokeColor(LINE).stroke();
    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor(MUTED)
      .text(
        `${m.seller.name}${m.seller.address ? ` · ${m.seller.address}` : ''} · Hosted in the EU`,
        56,
        footY + 10,
        { width: pageW },
      );

    doc.end();
  });
}
