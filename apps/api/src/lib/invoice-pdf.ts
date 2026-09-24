// The Fibre's own invoice PDF ("Download PDF opens Stripe" — Sjoerd,
// 2026-09-04: it must not). Drawn with pdfkit from the shared invoice model
// — masthead, seller, buyer, line, subtotal/VAT/total, footer. Standard
// Helvetica and Courier only, so no font files ship with the image.
//
// WHAT this document contains is decided once, in
// @thefibre/shared/invoice-model, and shared with the invoice email and the
// on-screen dialog. This file decides only how it LOOKS on A4. The three
// used to derive the facts separately and had drifted (2026-09-09).
//
// ── Redrawn 2026-09-24 ────────────────────────────────────────────────────
// Sjoerd: *"it is now two pages. Please make it one. Logo of the company is
// missing. make it look better. Design wise. More space. A old style receipt
// like invoice."*
//
// The second page was not a layout that outgrew A4 — it was ONE STRING. The
// footer printed the seller address, and an address is stored multi-line
// ("Stationsplein 45, unit 133\n3013AK Rotterdam\nThe Netherlands"). Starting
// at y≈762 on an 842pt page, three lines ran past the bottom margin and
// pdfkit did the only thing it can: began page two, carrying one orphan line
// of footer. Every address in the document is flattened to a single line now,
// and `oneLine` exists so the next person cannot reintroduce it by accident.

import PDFDocument from 'pdfkit';
import { invoiceModel, type InvoicePurchase, type InvoiceSeller } from '@thefibre/shared';

export type PdfInvoice = InvoicePurchase;
export type PdfSeller = InvoiceSeller & {
  legal_name: string;
  /** The workspace's brand mark. Raster only — see `fetchLogo`. */
  logo_url?: string | null;
};

import { LIGHT } from '@thefibre/shared/design/tokens';

/** The brand palette, as pdfkit wants it. Derived, never typed: this file
 *  used to carry five hand-written hexes, which is exactly the drift
 *  docs/brand-design.md exists to stop — a tax document is not the place for
 *  a sixth grey nobody chose. */
const hex = (token: keyof typeof LIGHT): string =>
  `#${LIGHT[token]
    .split(' ')
    .map((n) => Number(n).toString(16).padStart(2, '0'))
    .join('')}`;

const INK = hex('ink');
const SUBTLE = hex('ink-subtle');
const MUTED = hex('ink-muted');
const LINE = hex('line');
const BAND = hex('paper');

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

/** Addresses are stored with newlines. In a fixed-height band — the masthead,
 *  the footer — a newline is a page break waiting to happen. */
function oneLine(s: string | null | undefined): string {
  return (s ?? '').replace(/\s*\n\s*/g, ' · ').trim();
}

/**
 * Trim a string until it genuinely fits `width` at the CURRENT font and size.
 *
 * `{ lineBreak: false }` was supposed to do this and does not: a string wider
 * than its box still wraps, and a wrapped line low on the page is how the
 * footer opened a second one. Measured here instead, because `widthOfString`
 * is the same measurement pdfkit lays out with — the only one that cannot
 * disagree with what gets drawn.
 *
 * Call it AFTER selecting the font and size you will draw with.
 */
function fitOneLine(doc: PDFKit.PDFDocument, text: string, width: number): string {
  if (doc.widthOfString(text) <= width) return text;
  let cut = text;
  while (cut.length > 1 && doc.widthOfString(`${cut}…`) > width) {
    cut = cut.slice(0, -1);
  }
  return `${cut.trimEnd()}…`;
}

/**
 * The brand mark, if we can actually draw it.
 *
 * pdfkit embeds PNG and JPEG and nothing else — notably NOT SVG, which is
 * what several workspaces have uploaded (The Thread's own mark is an .svg).
 * So this returns null far more often than it fails, and a null must be
 * invisible: an invoice without a logo is a fine invoice, an invoice that
 * 500s because a logo moved is not.
 *
 * Bounded on purpose: https only, three seconds, 2MB. This URL comes from a
 * database row, and rendering a tax document is not the place to wait on
 * somebody else's server.
 */
async function fetchLogo(url: string | null | undefined): Promise<Buffer | null> {
  if (!url || !/^https:\/\//i.test(url)) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return null;
    const type = (res.headers.get('content-type') ?? '').toLowerCase();
    if (!type.includes('png') && !type.includes('jpeg') && !type.includes('jpg')) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return buf.byteLength > 2_000_000 ? null : buf;
  } catch {
    return null;
  }
}

export async function buildInvoicePdf(inv: PdfInvoice, seller: PdfSeller): Promise<Buffer> {
  // Fetched BEFORE the document opens: pdfkit's stream is synchronous, and
  // awaiting mid-draw would interleave with `doc.end()`.
  const logo = await fetchLogo(seller.logo_url);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 64 });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const m = invoiceModel(inv, seller);
    const date = new Date(m.dateIso);
    const L = 64;
    const W = doc.page.width - 128;
    const R = L + W;
    const centre = { width: W, align: 'center' as const };

    const rule = (y: number, colour = LINE) =>
      doc.moveTo(L, y).lineTo(R, y).lineWidth(0.75).strokeColor(colour).stroke();
    /** The old ledger's double rule — above a total, and under the masthead. */
    const doubleRule = (y: number) => {
      rule(y);
      rule(y + 2.5);
    };

    // ── Masthead: mark + word, top left ────────────────────────────────────
    // After a reference Sjoerd sent (2026-09-24): logo and the word INVOICE
    // together on the top line, the parties beneath, the table given room,
    // and the money in a band across the foot. The earlier drafts crowded
    // everything into the top third and left the page empty below the total,
    // which is what "it still looks ugly" was pointing at.
    let y = 72;
    let titleX = L;
    const TITLE_SIZE = 17;
    // The word's cap height, near enough: what the eye lines a mark up with,
    // not the em box.
    const capH = TITLE_SIZE * 0.72;
    let titleY = y;
    if (logo) {
      try {
        // A wordmark is wide and short; a square `fit` box therefore drew it
        // small and pinned to the TOP of that box, which is why it floated
        // above the word (Sjoerd: *"logo and receipt on the same line"*).
        // Fixed HEIGHT instead, and the real drawn width read off the image
        // so the title starts a measured gap after it — then both are centred
        // on the same horizontal axis.
        // `openImage` is real but missing from pdfkit's types, and the size
        // is the whole point here — guessing it is what drew the mark wrong.
        const img = (
          doc as unknown as { openImage(src: Buffer): { width: number; height: number } }
        ).openImage(logo);
        const drawH = Math.min(26, img.height);
        const drawW = (img.width / img.height) * drawH;
        const axis = y + capH / 2;
        doc.image(logo, L, axis - drawH / 2, { height: drawH });
        titleX = L + drawW + 18;
        titleY = axis - capH / 2 - TITLE_SIZE * 0.2;
      } catch {
        /* a corrupt image must not cost the invoice */
      }
    }
    doc
      .fillColor(INK)
      .font('Helvetica-Bold')
      .fontSize(TITLE_SIZE)
      .text(m.kind === 'receipt' ? 'RECEIPT' : 'INVOICE', titleX, titleY, {
        width: W - (titleX - L),
        characterSpacing: 3,
      });

    // ── Parties ────────────────────────────────────────────────────────────
    y = 196;
    const colW = W * 0.46;
    const rightX = L + W - colW;

    // Both columns are set on ONE baseline grid, the way a page is set in
    // InDesign (Sjoerd, 2026-09-24: *"align the client data (date issued etc.)
    // with the data from the company (like baseline grid)"*). Two things were
    // fighting it before: the columns started at different offsets, and
    // pdfkit positions text by the TOP of its line box — so two different
    // sizes on the same `y` sit on two different baselines. `topFor` converts
    // a baseline back into the top pdfkit wants, which is what makes a 12pt
    // name and a 9pt name share a line.
    const GRID = 14;
    const ASCENDER = 0.718; // Helvetica, near enough for this purpose
    const topFor = (baseline: number, size: number) => baseline - size * ASCENDER;
    const baselineOf = (row: number) => y + 12 + row * GRID;

    const NAME_L = 12;
    const NAME_R = 9;
    doc
      .fillColor(INK)
      .font('Helvetica-Bold')
      .fontSize(NAME_L)
      .text(m.buyer.name, L, topFor(baselineOf(0), NAME_L), { width: colW, lineBreak: false });

    const rightCol = { width: colW, align: 'right' as const, lineBreak: false };
    doc
      .font('Helvetica-Bold')
      .fontSize(NAME_R)
      .fillColor(INK)
      .text(m.seller.name, rightX, topFor(baselineOf(0), NAME_R), rightCol);

    // A blank grid row under the names, then both columns step together.
    let row = 2;

    const pair = (label: string, value: string, r: number) => {
      const b = baselineOf(r);
      doc.font('Helvetica').fontSize(8).fillColor(MUTED).text(label, L, topFor(b, 8), {
        width: 64,
        lineBreak: false,
      });
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor(INK).text(value, L + 68, topFor(b, 8.5), {
        width: colW - 68,
        lineBreak: false,
      });
    };

    const leftRows: [string, string][] = [
      [
        'Date issued:',
        date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      ],
    ];
    if (m.number) leftRows.push([m.kind === 'receipt' ? 'Receipt No:' : 'Invoice No:', m.number]);
    if (m.buyer.taxNo) leftRows.push(['VAT:', m.buyer.taxNo]);
    if (m.buyer.email) leftRows.push(['Email:', m.buyer.email]);
    leftRows.forEach(([label, value], i) => pair(label, value, row + i));

    const rightRows = oneLine(m.seller.address).split(' · ').filter(Boolean);
    doc.font('Helvetica').fontSize(8.5).fillColor(SUBTLE);
    rightRows.forEach((part, i) => {
      doc.text(fitOneLine(doc, part, colW), rightX, topFor(baselineOf(row + i), 8.5), rightCol);
    });
    let rightRowCount = rightRows.length;
    if (m.seller.taxNo) {
      doc
        .fillColor(MUTED)
        .text(`VAT ${m.seller.taxNo}`, rightX, topFor(baselineOf(row + rightRowCount), 8.5), rightCol);
      rightRowCount += 1;
    }

    const lastRow = row + Math.max(leftRows.length, rightRowCount) - 1;
    const leftY = baselineOf(lastRow);
    const rightY = leftY;

    // ── Table ──────────────────────────────────────────────────────────────
    y = Math.max(leftY, rightY) + 64;
    const caps = (text: string, x: number, yy: number, w: number, align: 'left' | 'right') =>
      doc
        .font('Helvetica')
        .fontSize(7)
        .fillColor(MUTED)
        .text(text, x, yy, { width: w, align, characterSpacing: 1.5 });

    caps('DESCRIPTION', L, y, W * 0.6, 'left');
    caps('AMOUNT', L, y, W, 'right');
    y += 13;
    rule(y);
    y += 20;

    const amountAt = (val: string, yy: number, bold = false, size = 10) =>
      doc
        .font(bold ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(size)
        .text(val, L, yy, { width: W, align: 'right' });

    doc.font('Helvetica-Bold').fontSize(10.5).fillColor(INK).text(m.line.label, L, y, {
      width: W * 0.62,
    });
    let lineBottom = doc.y;
    if (m.line.serviceUntilIso) {
      doc
        .font('Helvetica')
        .fontSize(8.5)
        .fillColor(MUTED)
        .text(
          `Service until ${new Date(m.line.serviceUntilIso).toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })}`,
          L,
          doc.y + 2,
          { width: W * 0.62 },
        );
      lineBottom = doc.y;
    }
    doc.fillColor(INK);
    amountAt(money(m.line.amountCents, m.currency), y, false, 10.5);
    y = Math.max(lineBottom, y + 14) + 22;

    if (m.totals.tax) {
      rule(y - 10);
      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor(SUBTLE)
        .text(m.totals.tax.label ?? 'VAT', L, y, { width: W * 0.62 });
      doc.fillColor(SUBTLE);
      amountAt(money(m.totals.tax.amountCents, m.currency), y, false, 9);
    }

    // ── Foot band ──────────────────────────────────────────────────────────
    // Full bleed, so the money has weight without needing a colour the brand
    // does not have. (The reference put the total in coral; our palette has
    // exactly one accent and it is ink — docs/brand-design.md. If a brand
    // colour for money is wanted, that is a tokens.ts decision, not a thing
    // to invent inside a tax document.)
    // The band is the page's counterweight: fixed height, flush to the foot.
    // With a single line item the table ends high, so the WHITE above is what
    // gets tuned — the blocks above are spaced to reach down toward it rather
    // than the band being dragged up into the table. A band tall enough to
    // close the gap would read as a grey page with a note on it.
    const bandTop = doc.page.height - 226;
    doc.rect(0, bandTop, doc.page.width, doc.page.height - bandTop).fill(BAND);

    let by = bandTop + 42;
    const third = W / 3;
    caps('PAID WITH', L, by, third, 'left');
    caps('DATE', L + third, by, third, 'left');
    caps('TOTAL', L, by, W, 'right');
    by += 16;

    doc
      .font('Helvetica-Bold')
      .fontSize(12)
      .fillColor(INK)
      // Capitalised even on the fallback: `raw.method` is a column value and
      // reads as one ("card") next to two properly typeset fields.
      .text(
        PDF_METHOD[m.method] ?? m.raw.method.charAt(0).toUpperCase() + m.raw.method.slice(1),
        L,
        by + 5,
        { width: third },
      );
    doc
      .font('Helvetica-Bold')
      .fontSize(12)
      .fillColor(INK)
      .text(
        date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
        L + third,
        by + 5,
        { width: third },
      );
    doc.fillColor(INK);
    amountAt(`${m.currency} ${money(m.totals.totalCents, m.currency).replace(/^[^\d-]+/, '')}`, by, true, 20);

    // ♥ drawn, not typed: pdfkit's standard fonts are WinAnsi-encoded and
    // U+2665 is not in WinAnsi, so the character would silently vanish.
    // A path always renders and scales with the type around it.
    const heart = (x: number, baseline: number, size: number, colour: string) => {
      doc.save();
      doc.translate(x, baseline - size);
      doc.scale(size / 24);
      doc
        .path(
          'M12 21.35 10.55 20.03C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z',
        )
        .fill(colour);
      doc.restore();
    };

    const thanksY = bandTop + 152;
    heart(L, thanksY + 8, 9, INK);
    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor(SUBTLE)
      .text('Thank you!', L + 14, thanksY, { width: W * 0.5, lineBreak: false });

    // The seller's VAT number, not a hosting note: on a tax document the
    // registration is what belongs at the foot (Sjoerd, 2026-09-24).
    doc.font('Helvetica').fontSize(7.5).fillColor(MUTED);
    doc.text(
      fitOneLine(
        doc,
        m.seller.taxNo ? `${m.seller.name} · VAT ${m.seller.taxNo}` : m.seller.name,
        W * 0.6,
      ),
      L,
      thanksY + 1,
      { width: W, align: 'right', lineBreak: false },
    );

    doc.end();
  });
}
