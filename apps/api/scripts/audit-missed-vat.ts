// Every PAID app sale where VAT should have been added on top and was not —
// a list, not a change. For Sjoerd to decide per case (a payment link for the
// difference, or absorb it). Sjoerd, 2026-10-15: "Everything excl. VAT now".
//
//   cd apps/api
//   npx tsx --env-file=.env scripts/audit-missed-vat.ts prod
//   npx tsx --env-file=.env.staging scripts/audit-missed-vat.ts staging
//
// A sale is listed when ALL hold:
//   · it is a Membership, Thread or Meet sale, status paid, amount > 0;
//   · its seller (the workspace, or the organiser selling under their own
//     name) is VAT-registered today (lib/seller-vat.ts);
//   · no VAT was charged ON TOP: billing has no tax_cents, or the tax_cents
//     there is the old INCLUSIVE split ("incl. VAT …") — i.e. the buyer paid
//     the bare price.
// The VAT it would carry under the new rule is worked out by THE rule
// (lib/sale-vat.ts saleVatFrom) from the buyer's country:
//   billing.country → membership_member.country → person.country.
// A sale with a tax number abroad is marked "check: reverse charge?" — this
// script does not call VIES, so it cannot say the number is valid.
//
// Read-only. Exit 0 with a count and a total.

import { adminClient } from '../src/db.js';
import { getVatRates } from '../src/lib/vat.js';
import { saleVatFrom } from '../src/lib/sale-vat.js';
import { resolveSellerVat } from '../src/lib/seller-vat.js';

const STAGING_REF = 'lukhyylwhhjyihqtghvw';
const PRODUCTION_REF = 'zfsyyokepyycefbxiblc';
const target = process.argv[2];
if (target !== 'prod' && target !== 'staging') {
  console.error('usage: npx tsx --env-file=<env> scripts/audit-missed-vat.ts prod|staging');
  process.exit(64);
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
if (!url.includes(target === 'prod' ? PRODUCTION_REF : STAGING_REF)) {
  console.error(`REFUSED: you said ${target}, but the env file points at ${url || 'nothing'}.`);
  process.exit(2);
}

const { data: apps, error: appErr } = await adminClient.from('app').select('id, slug').in('slug', ['membership', 'the-thread', 'fibre-meet']);
if (appErr) throw new Error(`apps: ${appErr.message}`);
const appSlug = new Map((apps ?? []).map((a) => [a.id as string, a.slug as string]));
if (appSlug.size === 0) throw new Error('no app rows found — refusing to report an empty list as "nothing missed"');

type Row = {
  id: string;
  workspace_id: string;
  app_id: string;
  person_id: string | null;
  organiser_user_id: string | null;
  payer_name: string | null;
  payer_email: string | null;
  item_label: string | null;
  amount_cents: number;
  currency: string;
  paid_at: string | null;
  billing: Record<string, unknown> | null;
};
const rows: Row[] = [];
for (let from = 0; ; from += 1000) {
  const { data, error } = await adminClient
    .from('purchase')
    .select('id, workspace_id, app_id, person_id, organiser_user_id, payer_name, payer_email, item_label, amount_cents, currency, paid_at, billing')
    .in('app_id', [...appSlug.keys()])
    .eq('status', 'paid')
    .gt('amount_cents', 0)
    .order('paid_at', { ascending: true })
    .range(from, from + 999);
  if (error) throw new Error(`purchases: ${error.message}`);
  rows.push(...((data ?? []) as Row[]));
  if ((data ?? []).length < 1000) break;
}

const cfg = await getVatRates();
const sellerCache = new Map<string, boolean>();
async function registered(ws: string, organiser: string | null, slug: string): Promise<boolean> {
  // Membership sells as the workspace; Thread/Meet as the person when they
  // have their own details (resolveSellerVat falls back to the workspace).
  const who = slug === 'membership' ? null : organiser;
  const key = `${ws}|${who ?? ''}`;
  if (!sellerCache.has(key)) sellerCache.set(key, !!(await resolveSellerVat(ws, who)));
  return sellerCache.get(key)!;
}
async function buyerCountry(r: Row): Promise<string | null> {
  const b = (r.billing?.country as string | undefined)?.trim();
  if (b && /^[A-Za-z]{2}$/.test(b)) return b.toUpperCase();
  if (r.person_id) {
    const { data: m } = await adminClient.from('membership_member').select('country').eq('workspace_id', r.workspace_id).eq('person_id', r.person_id).maybeSingle();
    if (m?.country) return String(m.country).toUpperCase();
    const { data: p } = await adminClient.from('person').select('country').eq('id', r.person_id).maybeSingle();
    if (p?.country && /^[A-Za-z]{2}$/.test(String(p.country))) return String(p.country).toUpperCase();
  }
  return null;
}

const missed: string[] = [];
const totals = new Map<string, number>();
let considered = 0;
for (const r of rows) {
  const slug = appSlug.get(r.app_id)!;
  const label = (r.billing?.tax_label as string | undefined) ?? '';
  const chargedOnTop = typeof r.billing?.tax_cents === 'number' && !label.startsWith('incl.');
  if (chargedOnTop) continue;
  if (!(await registered(r.workspace_id, r.organiser_user_id, slug))) continue;
  considered++;
  const country = await buyerCountry(r);
  const taxNo = (r.billing?.tax_no as string | undefined)?.trim() || null;
  const v = saleVatFrom(cfg, { net_cents: r.amount_cents, seller_registered: true, country, vat_id_valid: false });
  if (v.tax_cents <= 0) continue;
  const home = cfg.home_country.toUpperCase();
  const check = taxNo && country && country !== home ? '  ⚠ tax number abroad — check: reverse charge?' : '';
  const where = country ?? `?? (no country — assumed ${home})`;
  missed.push(
    `  ${(r.paid_at ?? '').slice(0, 10)}  ${slug.padEnd(10)}  ${(r.amount_cents / 100).toFixed(2)} ${r.currency}  buyer ${where}  missing ${v.label} = ${(v.tax_cents / 100).toFixed(2)}  ` +
      `${r.payer_name ?? ''} <${r.payer_email ?? ''}>  "${r.item_label ?? ''}"  [purchase ${r.id}]${check}`,
  );
  totals.set(r.currency, (totals.get(r.currency) ?? 0) + v.tax_cents);
}

console.log(`${target}: ${rows.length} paid app sales; ${considered} by a VAT-registered seller without VAT on top; ${missed.length} where VAT would now apply.`);
if (missed.length) console.log(missed.join('\n'));
for (const [cur, cents] of totals) console.log(`\nTotal VAT not charged: ${(cents / 100).toFixed(2)} ${cur}`);
console.log('\nPer case: send a payment link for the difference, or absorb it. Nothing was changed.');
