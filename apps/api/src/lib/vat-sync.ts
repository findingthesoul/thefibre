// Magicfying the VAT module (Sjoerd, 2026-09-04): Stripe Tax as a SENSOR,
// our table as the record. For each country in the table we ask Stripe for
// a probe calculation (€100, consumer, tax-exclusive) and read the rate it
// would apply. Differences are applied to the table, logged, and mailed to
// the operator — the law changes, the table follows, and a human hears
// about it. No-ops quietly until Stripe Tax is activated.

import { adminClient } from '../db.js';
import { stripeOrNull } from './stripe/client.js';
import { getVatRates, setVatRates } from './vat.js';
import { getSetting, setSetting } from './platform-settings.js';
import { sendEmail } from './email/client.js';
import { ENTITY } from '@thefibre/shared';
import { ensureStripeTaxRates } from './vat-stripe.js';

export type VatSyncLog = {
  at: string;
  ok: boolean;
  changes: { country: string; from: number; to: number }[];
  errors: string[];
};

export async function lastVatSync(): Promise<VatSyncLog | null> {
  return getSetting<VatSyncLog | null>('vat_sync_log', null);
}

export async function syncVatRatesFromStripe(): Promise<VatSyncLog> {
  const log: VatSyncLog = { at: new Date().toISOString(), ok: false, changes: [], errors: [] };
  const stripe = stripeOrNull();
  if (!stripe) {
    log.errors.push('Stripe not configured');
    return log;
  }
  const cfg = await getVatRates();

  for (const country of Object.keys(cfg.rates)) {
    try {
      const calc = await stripe.tax.calculations.create({
        currency: 'eur',
        line_items: [{ amount: 10000, reference: 'vat-probe', tax_behavior: 'exclusive' }],
        customer_details: { address: { country }, address_source: 'billing' },
      });
      const breakdown = (calc.tax_breakdown ?? [])[0] as
        | { tax_rate_details?: { percentage_decimal?: string } }
        | undefined;
      const pctStr = breakdown?.tax_rate_details?.percentage_decimal;
      if (!pctStr) continue; // no rate returned (unregistered jurisdiction) — leave ours
      const pct = Number(pctStr);
      if (!Number.isFinite(pct) || pct <= 0 || pct > 50) continue;
      const ours = cfg.rates[country];
      if (ours !== undefined && Math.abs(ours - pct) >= 0.01) {
        log.changes.push({ country, from: ours, to: pct });
        cfg.rates[country] = pct;
      }
    } catch (e) {
      log.errors.push(`${country}: ${e instanceof Error ? e.message : 'probe failed'}`);
      // Tax not activated → every probe fails the same way; stop early.
      if (log.errors.length >= 3 && log.changes.length === 0) break;
    }
  }

  log.ok = log.errors.length === 0 || log.changes.length > 0;
  if (log.changes.length > 0) {
    await setVatRates(cfg);
    void ensureStripeTaxRates();
    const lines = log.changes.map((c) => `  ${c.country}: ${c.from}% → ${c.to}%`).join('\n');
    void sendEmail({
      to: ENTITY.whitelistEmail,
      subject: `VAT rates updated (${log.changes.length} change${log.changes.length === 1 ? '' : 's'})`,
      text: `Stripe Tax reports changed VAT rates; the platform table at /admin/vat was updated:\n\n${lines}\n\nVerify against the official register if in doubt.`,
      html: `<p>Stripe Tax reports changed VAT rates; the platform table at /admin/vat was updated:</p><pre>${lines}</pre><p>Verify against the official register if in doubt.</p>`,
    }).catch((e) => console.error('[vat-sync] notify email failed', e));
  }
  await setSetting('vat_sync_log', log);
  return log;
}

/** Weekly, checked hourly — cheap guard so deploys don't re-probe. */
export async function maybeSyncVatRates(): Promise<void> {
  try {
    const last = await lastVatSync();
    const age = last ? Date.now() - new Date(last.at).getTime() : Infinity;
    if (age < 7 * 24 * 3600 * 1000) return;
    const log = await syncVatRatesFromStripe();
    console.log(
      `[vat-sync] weekly check: ${log.changes.length} change(s), ${log.errors.length} error(s)`,
    );
  } catch (e) {
    console.error('[vat-sync] failed', e);
  }
}
